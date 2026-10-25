//! How long since the user last touched the keyboard or mouse. Windows only for now; the rules
//! for acting on it are `timekeeper_core::idle`.

/// Whether `idle_for` can answer here; the UI hides the idle setting when it can't.
pub const SUPPORTED: bool = cfg!(windows);

/// Time since the last input in this session, or `None` where that can't be read.
#[cfg(windows)]
pub fn idle_for() -> Option<std::time::Duration> {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    // SAFETY: `info` is a LASTINPUTINFO with `cbSize` set, as the call requires.
    if unsafe { GetLastInputInfo(&mut info) } == 0 {
        return None;
    }
    // Both are 32-bit tick counts that wrap every ~49.7 days; the wrapping difference stays right.
    // SAFETY: GetTickCount has no preconditions.
    let ms = unsafe { GetTickCount() }.wrapping_sub(info.dwTime);
    Some(std::time::Duration::from_millis(ms.into()))
}

#[cfg(not(windows))]
pub fn idle_for() -> Option<std::time::Duration> {
    None
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn reads_the_idle_time() {
        // Any session has had input at some point; this checks the call succeeds and is sane.
        let idle = super::idle_for().expect("GetLastInputInfo");
        assert!(idle < std::time::Duration::from_secs(50 * 24 * 3600));
    }
}
