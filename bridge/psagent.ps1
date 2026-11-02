# super-wechat-bot / psagent.ps1
# Persistent PowerShell helper: PrintWindow capture, Windows OCR (WinRT), mouse/keyboard input.
# Protocol: one JSON request per stdin line, one JSON response per stdout line.
# ASCII-only source on purpose (PS 5.1 loads BOM-less files as ANSI).
param([string]$ProcessName = "Weixin")

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$src = @'
using System;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
public class SwbWin32 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool alt);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(int a, int b, bool attach);
  [DllImport("kernel32.dll")] public static extern int GetCurrentThreadId();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  // The real main window: visible, big, and the WeChat window class.
  // (Get-Process MainWindowHandle can point at a hidden 314x50 tray window.)
  // Largest window of the given class. Minimized windows still report a rect
  // (usually at -32000), so visibility is NOT required here; the caller
  // restores the window and validates the geometry afterwards.
  public static IntPtr FindMainWindow(string cls) {
    IntPtr best = IntPtr.Zero;
    int bestArea = 0;
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      var sb = new StringBuilder(256);
      GetClassName(h, sb, 256);
      if (sb.ToString() != cls) return true;
      RECT r; GetWindowRect(h, out r);
      int w = r.Right - r.Left, ht = r.Bottom - r.Top;
      if (w <= 0 || ht <= 0) return true;
      int area = w * ht;
      if (area > bestArea) { bestArea = area; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static void Click(int x, int y) {
    SetCursorPos(x, y); Thread.Sleep(60);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(40);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }

  public static bool ForceForeground(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    if (!IsWindowVisible(h)) ShowWindow(h, 5);
    IntPtr fg = GetForegroundWindow();
    int fpid; GetWindowThreadProcessId(fg, out fpid);
    int tid = GetCurrentThreadId();
    bool attached = false;
    try {
      if (fpid != 0) attached = AttachThreadInput(tid, fpid, true);
      SwitchToThisWindow(h, true);
      SetForegroundWindow(h);
    } finally {
      if (attached) AttachThreadInput(tid, fpid, false);
    }
    return GetForegroundWindow() == h;
  }
}
'@
Add-Type -TypeDefinition $src
[void][SwbWin32]::SetProcessDPIAware()

$asyncName = "IAsyncOperation" + [char]96 + "1"
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq $asyncName
})[0]
function Await($WinRtTask, $ResultType) {
  $t = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
  $t.Wait(-1) | Out-Null
  $t.Result
}

[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null

$script:Engine = $null
function Get-OcrEngine {
  if (-not $script:Engine) {
    $script:Engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $script:Engine) { throw "no OCR engine (install a Windows OCR language pack)" }
  }
  return $script:Engine
}

$script:Cfg = @{
  chatLeftRatio  = 0.425
  msgTopRatio    = 0.105
  msgWidthRatio  = 0.565
  msgHeightRatio = 0.655
  inputX         = 0.660
  inputY         = 0.835
  searchX        = 0.230
  searchY        = 0.083
  titleX         = 0.420
  titleY         = 0.020
  titleW         = 0.300
  titleH         = 0.090
  ocrScale       = 1.0
}

function Find-Target {
  $hwnd = [SwbWin32]::FindMainWindow("Qt51514QWindowIcon")
  if ($hwnd -eq [IntPtr]::Zero) { throw "wechat main window not found (is WeChat running?)" }
  if ([SwbWin32]::IsIconic($hwnd)) {
    [void][SwbWin32]::ShowWindow($hwnd, 9)
    Start-Sleep -Milliseconds 350
  }
  $r = Get-Rect $hwnd
  if ($r.w -lt 600 -or $r.h -lt 400) {
    [void][SwbWin32]::ShowWindow($hwnd, 9)
    Start-Sleep -Milliseconds 350
    $r = Get-Rect $hwnd
  }
  if ($r.w -lt 600 -or $r.h -lt 400) { throw ("wechat window has no usable geometry (" + $r.w + "x" + $r.h + ")") }
  $procId = 0
  [void][SwbWin32]::GetWindowThreadProcessId($hwnd, [ref]$procId)
  return @{ hwnd = $hwnd; pid = $procId }
}

function Get-Rect($hwnd) {
  $r = New-Object SwbWin32+RECT
  [void][SwbWin32]::GetWindowRect($hwnd, [ref]$r)
  return @{ x = $r.Left; y = $r.Top; w = ($r.Right - $r.Left); h = ($r.Bottom - $r.Top) }
}

function Print-Window($hwnd, $w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  try { $ok = [SwbWin32]::PrintWindow($hwnd, $hdc, 2) } finally { $g.ReleaseHdc($hdc); $g.Dispose() }
  if (-not $ok) { $bmp.Dispose(); throw "PrintWindow failed" }
  return $bmp
}

# Capture even when covered. A window that is already the foreground window is
# captured directly; otherwise PrintWindow may silently return the cover window,
# so the result is checked against a desktop grab and only then is the foreground
# borrowed for exactly one capture.
function Capture-Window($target) {
  $hwnd = $target.hwnd
  if ([SwbWin32]::IsIconic($hwnd)) { [void][SwbWin32]::ShowWindow($hwnd, 9); Start-Sleep -Milliseconds 250 }
  $rect = Get-Rect $hwnd
  if ($rect.w -le 0 -or $rect.h -le 0) { throw "window has no size" }
  $bmp = Print-Window $hwnd $rect.w $rect.h
  $borrowed = $false
  $fg = [SwbWin32]::GetForegroundWindow()
  if ($fg -ne $hwnd) {
    $scr = New-Object System.Drawing.Bitmap $rect.w, $rect.h
    $g = [System.Drawing.Graphics]::FromImage($scr)
    $g.CopyFromScreen($rect.x, $rect.y, 0, 0, (New-Object System.Drawing.Size $rect.w, $rect.h))
    $g.Dispose()
    $diff = 0
    foreach ($pt in @(@(0.02,0.02), @(0.5,0.05), @(0.8,0.5), @(0.5,0.95), @(0.97,0.5))) {
      $px = [int]($rect.w * $pt[0]); $py = [int]($rect.h * $pt[1])
      if ($px -ge $rect.w) { $px = $rect.w - 1 }
      if ($py -ge $rect.h) { $py = $rect.h - 1 }
      $c1 = $bmp.GetPixel($px, $py); $c2 = $scr.GetPixel($px, $py)
      if (([Math]::Abs($c1.R - $c2.R) + [Math]::Abs($c1.G - $c2.G) + [Math]::Abs($c1.B - $c2.B)) -gt 24) { $diff++ }
    }
    $scr.Dispose()
    if ($diff -eq 0) {
      $bmp.Dispose()
      [void][SwbWin32]::ForceForeground($hwnd)
      Start-Sleep -Milliseconds 180
      $bmp = Print-Window $hwnd $rect.w $rect.h
      if ($fg -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($fg) }
      $borrowed = $true
    }
  }
  return @{ bmp = $bmp; hwnd = $hwnd; x = $rect.x; y = $rect.y; w = $rect.w; h = $rect.h; borrowed = $borrowed }
}

function Scale-Bitmap($bmp, $scale) {
  if ($scale -le 1.001) { return $bmp }
  $w = [int]($bmp.Width * $scale); $h = [int]($bmp.Height * $scale)
  $out = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  return $out
}

function Ocr-Bitmap($bmp, $scale) {
  if (-not $scale) { $scale = 1.0 }
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  $file = Join-Path $env:TEMP ("swb-ocr-" + [guid]::NewGuid().ToString("N") + ".png")
  [System.IO.File]::WriteAllBytes($file, $bytes)
  try {
    $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($file)) ([Windows.Storage.StorageFile])
    $stream = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sbmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await ((Get-OcrEngine).RecognizeAsync($sbmp)) ([Windows.Media.Ocr.OcrResult])
    $out = @()
    foreach ($line in $res.Lines) {
      $words = @($line.Words)
      if ($words.Count -eq 0) { continue }
      $x = [double]::MaxValue; $y = [double]::MaxValue; $right = 0.0; $bottom = 0.0
      foreach ($wd in $words) {
        $br = $wd.BoundingRect
        if ($br.X -lt $x) { $x = $br.X }
        if ($br.Y -lt $y) { $y = $br.Y }
        if (($br.X + $br.Width) -gt $right) { $right = $br.X + $br.Width }
        if (($br.Y + $br.Height) -gt $bottom) { $bottom = $br.Y + $br.Height }
      }
      # coordinates are divided back to the un-scaled bitmap space
      $bg = ""
      $sx = [int](($x - 10 * $scale) / $scale); if ($sx -lt 0) { $sx = 0 }
      $sy = [int](($y + ($bottom - $y) / 2) / $scale); if ($sy -ge $bmp.Height) { $sy = $bmp.Height - 1 }
      if ($sy -lt 0) { $sy = 0 }
      try { $pc = $bmp.GetPixel($sx, $sy); $bg = ("{0:X2}{1:X2}{2:X2}" -f $pc.R, $pc.G, $pc.B) } catch { $bg = "" }
      $out += [ordered]@{
        x = [int]($x / $scale); y = [int]($y / $scale);
        w = [int](($right - $x) / $scale); h = [int](($bottom - $y) / $scale);
        t = $line.Text; bg = $bg
      }
    }
    return $out
  } finally {
    Remove-Item $file -Force -ErrorAction SilentlyContinue
  }
}

# Input box placeholder / OCR noise must not count as real typed text.
function Test-RealInput([string]$t) {
  if ([string]::IsNullOrWhiteSpace($t)) { return $false }
  if ($t -match "长按|语音|发消息|输入") { return $false }
  return $true
}

function Read-InputArea($target) {
  try {
    $cap = Capture-Window $target
    try {
      $bmp = $cap.bmp
      $ix = [int]($cap.w * 0.430); $iy = [int]($cap.h * 0.775)
      $iw = [int]($cap.w * 0.555); $ih = [int]($cap.h * 0.075)
      if (($ix + $iw) -gt $bmp.Width) { $iw = $bmp.Width - $ix }
      if (($iy + $ih) -gt $bmp.Height) { $ih = $bmp.Height - $iy }
      if ($iw -le 0 -or $ih -le 0) { return "" }
      $crop = $bmp.Clone((New-Object System.Drawing.Rectangle $ix, $iy, $iw, $ih), $bmp.PixelFormat)
      try {
        $text = ""
        foreach ($l in (Ocr-Bitmap $crop 1.0)) { $text += $l.t }
        return ($text -replace "\s+", "")
      } finally { $crop.Dispose() }
    } finally { $cap.bmp.Dispose() }
  } catch { return "" }
}

function Read-Title($cap) {
  try {
    $c = $script:Cfg
    $tx = [int]($cap.w * $c.titleX); $ty = [int]($cap.h * $c.titleY)
    $tw = [int]($cap.w * $c.titleW); $th = [int]($cap.h * $c.titleH)
    $tb = $cap.bmp.Clone((New-Object System.Drawing.Rectangle $tx, $ty, $tw, $th), $cap.bmp.PixelFormat)
    try {
      $tbig = Scale-Bitmap $tb 2.0
      $txt = ""
      foreach ($l in (Ocr-Bitmap $tbig 2.0)) { $txt += $l.t }
      if (-not [object]::ReferenceEquals($tbig, $tb)) { $tbig.Dispose() }
      return ($txt -replace "\s+", "")
    } finally { $tb.Dispose() }
  } catch { return "" }
}

function Reply($id, $ok, $payload) {
  $resp = [ordered]@{ id = $id; ok = $ok }
  if ($payload -is [System.Collections.IDictionary]) { foreach ($k in $payload.Keys) { if ($k -ne "id") { $resp[$k] = $payload[$k] } } }
  elseif ($null -ne $payload) { $resp["result"] = $payload }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $resp -Compress -Depth 10))
  [Console]::Out.Flush()
}

$script:LastHash = ""
$script:LastLines = @()
$script:LastTitle = ""
$script:LastTitleMs = 0

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $id = 0
  try {
    $req = ConvertFrom-Json -InputObject $line
    $id = [int]$req.id
    switch ([string]$req.cmd) {
      "ping" {
        $t = Find-Target
        $rect = Get-Rect $t.hwnd
        Reply $id $true ([ordered]@{ pong = $true; hwnd = [int]$t.hwnd; pid = $t.pid; visible = [SwbWin32]::IsWindowVisible($t.hwnd); ocr = ((Get-OcrEngine).RecognizerLanguage.LanguageTag); rect = $rect })
      }
      "config" {
        if ($req.cfg) { foreach ($p in $req.cfg.PSObject.Properties) { $v = $p.Value; if ($null -eq $v) { continue }; $num = 0.0; if ([double]::TryParse([string]$v, [ref]$num)) { $script:Cfg[$p.Name] = $num } } }
        $script:LastHash = ""
        Reply $id $true ([ordered]@{ cfg = $script:Cfg })
      }
      "poll" {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $t = Find-Target
        $cap = Capture-Window $t
        $capMs = $sw.ElapsedMilliseconds
        $bmp = $cap.bmp
        try {
          $c = $script:Cfg
          $cx = [int]($cap.w * $c.chatLeftRatio)
          $cy = [int]($cap.h * $c.msgTopRatio)
          $cw = [int]($cap.w * $c.msgWidthRatio)
          $ch = [int]($cap.h * $c.msgHeightRatio)
          $crop = $bmp.Clone((New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), $bmp.PixelFormat)
          try {
            $ms = New-Object System.IO.MemoryStream
            $crop.Save($ms, [System.Drawing.Imaging.ImageFormat]::Bmp)
            $md5 = [BitConverter]::ToString([System.Security.Cryptography.MD5]::Create().ComputeHash($ms.ToArray())).Replace("-", "")
            $ms.Dispose()
            $nowMs = [Environment]::TickCount64
            $needTitle = $changed -or (($nowMs - $script:LastTitleMs) -gt 2000)
            if ($needTitle) {
              $title = Read-Title $cap
              $script:LastTitle = $title
              $script:LastTitleMs = $nowMs
            } else {
              $title = $script:LastTitle
            }
            $changed = ($md5 -ne $script:LastHash)
            $ocrMs = 0
            $lines = $script:LastLines
            if ($changed) {
              $sw2 = [Diagnostics.Stopwatch]::StartNew()
              $scale = [double]$c.ocrScale
              $big = Scale-Bitmap $crop $scale
              $lines = Ocr-Bitmap $big $scale
              if (-not [object]::ReferenceEquals($big, $crop)) { $big.Dispose() }
              $ocrMs = $sw2.ElapsedMilliseconds
              $script:LastHash = $md5
              $script:LastLines = $lines
            }
            Reply $id $true ([ordered]@{
              hash = $md5; changed = $changed; lines = $lines; title = $title;
              bounds = [ordered]@{ x = $cap.x; y = $cap.y; w = $cap.w; h = $cap.h };
              crop = [ordered]@{ x = ($cap.x + $cx); y = ($cap.y + $cy); w = $cw; h = $ch };
              borrowed = $cap.borrowed; capMs = $capMs; ocrMs = $ocrMs
            })
          } finally { $crop.Dispose() }
        } finally { $bmp.Dispose() }
      }
      "shot" {
        $t = Find-Target
        $cap = Capture-Window $t
        try {
          $path = [string]$req.path
          $cap.bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
          Reply $id $true ([ordered]@{ path = $path; bounds = [ordered]@{ x = $cap.x; y = $cap.y; w = $cap.w; h = $cap.h } })
        } finally { $cap.bmp.Dispose() }
      }
      "input" {
        $t = Find-Target
        Reply $id $true ([ordered]@{ text = (Read-InputArea $t) })
      }
      "send" {
        $t = Find-Target
        $hwnd = $t.hwnd
        $rect = Get-Rect $hwnd
        $cap = @{ bmp = (Print-Window $hwnd $rect.w $rect.h); hwnd = $hwnd; x = $rect.x; y = $rect.y; w = $rect.w; h = $rect.h }
        $geo = [ordered]@{ x = $cap.x; y = $cap.y; w = $cap.w; h = $cap.h }
        $title = Read-Title $cap
        $cap.bmp.Dispose()
        if ($req.expect) {
          $normTitle = ($title -replace "\s+", "").ToLower()
          $normExpect = ([string]$req.expect -replace "\s+", "").ToLower()
          if ($normTitle -ne $normExpect) {
            Reply $id $true ([ordered]@{ sent = $false; error = "title-mismatch"; title = $title; expect = $req.expect })
            continue
          }
        }
        $fast = [bool]$req.fast
        $d1 = if ($fast) { 110 } else { 220 }
        $d2 = if ($fast) { 80 } else { 150 }
        $d3 = if ($fast) { 150 } else { 240 }
        $prev = [SwbWin32]::GetForegroundWindow()
        if (-not [SwbWin32]::ForceForeground($hwnd)) {
          Reply $id $true ([ordered]@{ sent = $false; error = "cannot-focus"; title = $title })
          continue
        }
        Start-Sleep -Milliseconds $d1
        $ix = $cap.x + [int]($cap.w * $script:Cfg.inputX)
        $iy = $cap.y + [int]($cap.h * $script:Cfg.inputY)
        [SwbWin32]::Click($ix, $iy)
        Start-Sleep -Milliseconds $d2
        if ($req.clear) {
          [System.Windows.Forms.SendKeys]::SendWait("^a")
          Start-Sleep -Milliseconds 40
          [System.Windows.Forms.SendKeys]::SendWait("{DEL}")
          Start-Sleep -Milliseconds 60
        }
        Set-Clipboard -Value ([string]$req.text)
        Start-Sleep -Milliseconds 70
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds $d3
        $pasted = Read-InputArea $t
        if (-not (Test-RealInput $pasted)) {
          [SwbWin32]::Click($ix, $iy)
          Start-Sleep -Milliseconds 160
          Set-Clipboard -Value ([string]$req.text)
          Start-Sleep -Milliseconds 80
          [System.Windows.Forms.SendKeys]::SendWait("^v")
          Start-Sleep -Milliseconds 280
          $pasted = Read-InputArea $t
        }
        if (-not (Test-RealInput $pasted)) {
          if ($prev -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($prev) }
          Reply $id $true ([ordered]@{ sent = $false; error = "paste-empty"; pasted = $pasted; title = $title })
          continue
        }
        # last-moment gate: still WeChat? still the right chat? still focused?
        $fgNow = [SwbWin32]::GetForegroundWindow()
        if ($fgNow -ne $hwnd) {
          [System.Windows.Forms.SendKeys]::SendWait("^a")
          [System.Windows.Forms.SendKeys]::SendWait("{DEL}")
          if ($prev -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($prev) }
          Reply $id $true ([ordered]@{ sent = $false; error = "focus-lost"; pasted = $pasted })
          continue
        }
        $sent = $false
        $remaining = $pasted
        if (-not $req.noenter) {
          [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
          if ($fast) {
            Start-Sleep -Milliseconds 90
            $remaining = ""
          } else {
            Start-Sleep -Milliseconds 260
            $remaining = Read-InputArea $t
          }
          $sent = $true
        }
        if ($prev -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($prev) }
        Reply $id $true ([ordered]@{ sent = $sent; pasted = $pasted; remaining = $remaining; title = $title; point = [ordered]@{ x = $ix; y = $iy }; bounds = $geo })
      }
      "type" {
        $t = Find-Target
        $cap = Capture-Window $t
        $hwnd = $t.hwnd
        $ix = $cap.x + [int]($cap.w * $script:Cfg.inputX)
        $iy = $cap.y + [int]($cap.h * $script:Cfg.inputY)
        $cap.bmp.Dispose()
        $prev = [SwbWin32]::GetForegroundWindow()
        [void][SwbWin32]::ForceForeground($hwnd)
        Start-Sleep -Milliseconds 220
        [SwbWin32]::Click($ix, $iy)
        Start-Sleep -Milliseconds 150
        Set-Clipboard -Value ([string]$req.text)
        Start-Sleep -Milliseconds 70
        [System.Windows.Forms.SendKeys]::SendWait("^v")
        Start-Sleep -Milliseconds 150
        if ($prev -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($prev) }
        Reply $id $true ([ordered]@{ typed = $true })
      }
      "key" {
        $t = Find-Target
        $prev = [SwbWin32]::GetForegroundWindow()
        [void][SwbWin32]::ForceForeground($t.hwnd)
        Start-Sleep -Milliseconds 200
        [System.Windows.Forms.SendKeys]::SendWait([string]$req.keys)
        Start-Sleep -Milliseconds 160
        if ($prev -ne [IntPtr]::Zero) { [void][SwbWin32]::SetForegroundWindow($prev) }
        Reply $id $true ([ordered]@{ keys = [string]$req.keys })
      }
      default { throw "unknown cmd: $($req.cmd)" }
    }
  } catch {
    Reply $id $false ([ordered]@{ error = $_.Exception.Message })
  }
}
