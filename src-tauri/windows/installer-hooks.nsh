!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Closing running Codex Mate before installing..."
  nsExec::ExecToLog 'taskkill /IM "codexmate-desktop.exe" /F'
!macroend
