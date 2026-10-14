; Tauri's uninstaller already deletes the HKCU Run value named ${PRODUCTNAME} (src/login.rs),
; except in /UPDATE mode. This also removes the Task Manager flag stored beside it.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
