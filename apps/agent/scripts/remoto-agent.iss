#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
#ifndef StagingDir
  #define StagingDir "."
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

[Setup]
AppId={{A9D0A8A7-3B65-4D14-A6DF-1D8EA7A7C9B2}
AppName=Remoto Agent
AppVersion={#AppVersion}
AppPublisher=Remoto
AppPublisherURL=https://github.com/AndreHigo/Remote
AppSupportURL=https://github.com/AndreHigo/Remote
AppUpdatesURL=https://github.com/AndreHigo/Remote
DefaultDirName={autopf}\Remoto Agent
DefaultGroupName=Remoto
UninstallDisplayName=Remoto Agent
Uninstallable=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
DisableProgramGroupPage=yes
CloseApplications=force
CloseApplicationsFilter=RemotoAgent.exe,RemotoAgentService.exe
RestartApplications=no
OutputDir={#OutputDir}
OutputBaseFilename=RemotoAgent-Setup
Compression=lzma2
SolidCompression=yes
SetupLogging=yes
VersionInfoDescription=Remoto Agent
VersionInfoProductName=Remoto Agent
VersionInfoCompany=Remoto
UninstallDisplayIcon={app}\RemotoAgent.exe

[Files]
Source: "{#StagingDir}\RemotoAgent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\RemotoAgentService.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\install-package.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\repair-installed-agent.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\uninstall-package.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\homologate-host.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StagingDir}\ffmpeg\ffmpeg.exe"; DestDir: "{app}\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\ffmpeg\FFMPEG-LICENSE.txt"; DestDir: "{app}\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\ffmpeg\FFMPEG-README.txt"; DestDir: "{app}\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#StagingDir}\THIRD-PARTY-NOTICES.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\Reparar Remoto Agent"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\repair-installed-agent.ps1"""; WorkingDir: "{app}"; Comment: "Corrige a configuracao, o servico e a tarefa interativa do agente"

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall-package.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveRemotoAgentService"

[UninstallDelete]
Type: files; Name: "{app}\.remoto-agent.config.json"
Type: files; Name: "{app}\.remoto-agent.state.json"
Type: dirifempty; Name: "{app}\ffmpeg"
Type: dirifempty; Name: "{app}"

[Code]
var
  ConnectionPage: TInputQueryWizardPage;
  ServiceInstallResult: Integer;

function QuoteArgument(Value: string): string;
begin
  Result := '"' + Value + '"';
end;

function HasInvalidInput(Value: string): Boolean;
begin
  Result := (Pos('"', Value) > 0) or (Pos(#13, Value) > 0) or (Pos(#10, Value) > 0);
end;

function HasExactHost(Value: string; Prefix: string): Boolean;
var
  Tail: string;
begin
  Result := CompareText(Copy(Value, 1, Length(Prefix)), Prefix) = 0;
  if not Result then Exit;
  Tail := Copy(Value, Length(Prefix) + 1, Length(Value));
  if Tail = '' then begin
    Result := True;
    Exit;
  end;
  Result := (Tail[1] = ':') or (Tail[1] = '/') or (Tail[1] = '?') or (Tail[1] = '#');
end;

function IsLoopbackUrl(Value: string): Boolean;
var
  LowerValue: string;
begin
  LowerValue := Lowercase(Trim(Value));
  Result := HasExactHost(LowerValue, 'http://localhost') or
    HasExactHost(LowerValue, 'https://localhost') or
    HasExactHost(LowerValue, 'ws://localhost') or
    HasExactHost(LowerValue, 'wss://localhost') or
    HasExactHost(LowerValue, 'http://127.0.0.1') or
    HasExactHost(LowerValue, 'https://127.0.0.1') or
    HasExactHost(LowerValue, 'ws://127.0.0.1') or
    HasExactHost(LowerValue, 'wss://127.0.0.1') or
    HasExactHost(LowerValue, 'http://[::1]') or
    HasExactHost(LowerValue, 'https://[::1]') or
    HasExactHost(LowerValue, 'ws://[::1]') or
    HasExactHost(LowerValue, 'wss://[::1]');
end;

function ReadJsonValue(FilePath: string; Name: string; DefaultValue: string): string;
var
  Raw: AnsiString;
  Marker: string;
  Tail: string;
  StartPos: Integer;
  EndPos: Integer;
begin
  Result := DefaultValue;
  if not FileExists(FilePath) then Exit;
  if not LoadStringFromFile(FilePath, Raw) then Exit;

  Marker := '"' + Name + '"';
  StartPos := Pos(Marker, Raw);
  if StartPos = 0 then Exit;
  Tail := Copy(Raw, StartPos + Length(Marker), Length(Raw));
  StartPos := Pos(':', Tail);
  if StartPos = 0 then Exit;
  Delete(Tail, 1, StartPos);
  while (Length(Tail) > 0) and (Tail[1] in [' ', #9, #13, #10]) do Delete(Tail, 1, 1);
  if (Length(Tail) = 0) or (Tail[1] <> '"') then Exit;
  Delete(Tail, 1, 1);
  EndPos := Pos('"', Tail);
  if EndPos = 0 then Exit;
  Result := Copy(Tail, 1, EndPos - 1);
end;

function ReadExistingConfigValue(Name: string; DefaultValue: string): string;
begin
  Result := ReadJsonValue(ExpandConstant('{app}\.remoto-agent.config.json'), Name, DefaultValue);
end;

function ReadInstallerProfileValue(Name: string; DefaultValue: string): string;
begin
  Result := ReadJsonValue(ExpandConstant('{src}\remoto-agent-profile.json'), Name, DefaultValue);
end;

function InstallerParameter(Name: string): string;
begin
  Result := ExpandConstant('{param:' + Name + '|}');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ApiUrl: string;
  RealtimeUrl: string;
  AgentKey: string;
  FfmpegPath: string;
begin
  Result := True;
  if CurPageID <> ConnectionPage.ID then Exit;

  ApiUrl := Trim(ConnectionPage.Values[0]);
  RealtimeUrl := Trim(ConnectionPage.Values[1]);
  AgentKey := Trim(ConnectionPage.Values[2]);
  FfmpegPath := Trim(ConnectionPage.Values[3]);

  if ((CompareText(Copy(ApiUrl, 1, 7), 'http://') <> 0) and
      (CompareText(Copy(ApiUrl, 1, 8), 'https://') <> 0)) then begin
    MsgBox('Informe uma URL iniciando com http:// ou https://.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if (not IsLoopbackUrl(ApiUrl)) and (CompareText(Copy(ApiUrl, 1, 8), 'https://') <> 0) then begin
    MsgBox('A API deve usar https:// fora de localhost.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if ((CompareText(Copy(RealtimeUrl, 1, 5), 'ws://') <> 0) and
      (CompareText(Copy(RealtimeUrl, 1, 6), 'wss://') <> 0)) then begin
    MsgBox('A URL do relay deve iniciar com ws:// ou wss://.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if (not IsLoopbackUrl(RealtimeUrl)) and (CompareText(Copy(RealtimeUrl, 1, 6), 'wss://') <> 0) then begin
    MsgBox('O relay deve usar wss:// fora de localhost.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if AgentKey = '' then begin
    MsgBox('Informe a chave do agente gerada no painel.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if HasInvalidInput(ApiUrl) or HasInvalidInput(RealtimeUrl) or HasInvalidInput(AgentKey) or HasInvalidInput(FfmpegPath) or
     (Pos('@', ApiUrl) > 0) or (Pos('@', RealtimeUrl) > 0) then begin
    MsgBox('As URLs e a chave nao podem conter credenciais, aspas ou quebras de linha.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure InstallAgentService;
var
  PowerShellPath: string;
  ScriptPath: string;
  AgentKeyFile: string;
  Parameters: string;
  ExecResult: Boolean;
begin
  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  ScriptPath := ExpandConstant('{app}\install-package.ps1');
  AgentKeyFile := AddBackslash(ExpandConstant('{tmp}')) + 'remoto-agent-key.txt';
  SaveStringToFile(AgentKeyFile, Trim(ConnectionPage.Values[2]), False);
  Parameters := '-NoProfile -ExecutionPolicy Bypass -File ' + QuoteArgument(ScriptPath) +
    ' -ApiUrl ' + QuoteArgument(Trim(ConnectionPage.Values[0])) +
    ' -RealtimeUrl ' + QuoteArgument(Trim(ConnectionPage.Values[1])) +
    ' -AgentKeyFile ' + QuoteArgument(AgentKeyFile);
  if Trim(ConnectionPage.Values[3]) <> '' then begin
    Parameters := Parameters + ' -FfmpegPath ' + QuoteArgument(Trim(ConnectionPage.Values[3]));
  end;

  ExecResult := Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ServiceInstallResult);
  DeleteFile(AgentKeyFile);
  if (not ExecResult) or (ServiceInstallResult <> 0) then begin
    MsgBox('O agente foi copiado, mas o servico nao pode ser iniciado. Codigo: ' +
      IntToStr(ServiceInstallResult) + '.', mbError, MB_OK);
  end else begin
    { O perfil contem uma chave bearer de uso inicial; remova a copia de origem apos o cadastro. }
    DeleteFile(ExpandConstant('{src}\remoto-agent-profile.json'));
  end;
end;

function StopExistingService: Boolean;
var
  ScPath: string;
  TaskKillPath: string;
  PowerShellPath: string;
  Parameters: string;
  ResultCode: Integer;
  ExecResult: Boolean;
begin
  Result := True;
  ScPath := ExpandConstant('{sys}\sc.exe');
  Exec(ScPath, 'stop RemotoAgent', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  Parameters := '-NoProfile -Command "$svc=Get-Service -Name ''RemotoAgent'' -ErrorAction SilentlyContinue; ' +
    '$deadline=(Get-Date).AddSeconds(10); while ($svc -and $svc.Status -ne ''Stopped'' -and (Get-Date) -lt $deadline) ' +
    '{ Start-Sleep -Milliseconds 250; $svc=Get-Service -Name ''RemotoAgent'' -ErrorAction SilentlyContinue }; ' +
    'if ($svc -and $svc.Status -ne ''Stopped'') { exit 1 }"';
  ExecResult := Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (not ExecResult) or (ResultCode <> 0) then begin
    Result := False;
    Exit;
  end;

  Parameters := '-NoProfile -Command "$p=Get-Process -Name ''RemotoAgent'' -ErrorAction SilentlyContinue; ' +
    'if ($p) { $p | Stop-Process -Force }; $deadline=(Get-Date).AddSeconds(10); ' +
    'while ((Get-Process -Name ''RemotoAgent'' -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) ' +
    '{ Start-Sleep -Milliseconds 250 }"';
  Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  { A stopped service can still have a short-lived host process. Force-close both
    known executables before Inno attempts to replace their files. }
  TaskKillPath := ExpandConstant('{sys}\taskkill.exe');
  Exec(ExpandConstant('{sys}\schtasks.exe'), '/End /TN "RemotoAgentDesktop"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(TaskKillPath, '/F /T /IM RemotoAgentService.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Exec(TaskKillPath, '/F /T /IM RemotoAgent.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  { FFmpeg is a child of the interactive capture process. Inno can still get
    ERROR_ACCESS_DENIED while replacing the bundled binary if that child has
    not released its handle. Match the executable path so unrelated FFmpeg
    processes on the computer are left alone. }
  Parameters := '-NoProfile -Command "$p=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ''ffmpeg.exe'' -and $_.ExecutablePath -and $_.ExecutablePath -match ''(?i)\\Remoto Agent\\ffmpeg\\ffmpeg\.exe$'' }; ' +
    '$p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; ' +
    '$deadline=(Get-Date).AddSeconds(10); while ((Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ''ffmpeg.exe'' -and $_.ExecutablePath -and $_.ExecutablePath -match ''(?i)\\Remoto Agent\\ffmpeg\\ffmpeg\.exe$'' }) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }; ' +
    'if (Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ''ffmpeg.exe'' -and $_.ExecutablePath -and $_.ExecutablePath -match ''(?i)\\Remoto Agent\\ffmpeg\\ffmpeg\.exe$'' }) { exit 1 }"';
  ExecResult := Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (not ExecResult) or (ResultCode <> 0) then begin
    Result := False;
    Exit;
  end;

  Parameters := '-NoProfile -Command "$deadline=(Get-Date).AddSeconds(10); while ((Get-Process -Name ''RemotoAgentService'', ''RemotoAgent'' -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }; if (Get-Process -Name ''RemotoAgentService'', ''RemotoAgent'' -ErrorAction SilentlyContinue) { exit 1 }"';
  ExecResult := Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := ExecResult and (ResultCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  if not StopExistingService then begin
    Result := 'Nao foi possivel encerrar o Remoto Agent. Feche sessoes remotas, execute Reparar Remoto Agent como administrador e tente novamente.';
    Exit;
  end;
  Result := '';
end;

procedure InitializeWizard;
var
  ParameterValue: string;
  ProfileValue: string;
begin
  ConnectionPage := CreateInputQueryPage(wpSelectDir,
    'Conexao do agente',
    'Informe onde o agente deve se conectar',
    'Esses dados serao usados para registrar este computador no painel Remoto.');
  ConnectionPage.Add('URL da API:', False);
  ConnectionPage.Add('URL do relay realtime:', False);
  ConnectionPage.Add('Chave do agente:', True);
  ConnectionPage.Add('Caminho do FFmpeg (opcional; sera protegido):', False);
  ProfileValue := ReadInstallerProfileValue('apiUrl', '');
  ConnectionPage.Values[0] := ProfileValue;
  ParameterValue := ReadExistingConfigValue('apiUrl', '');
  if ParameterValue <> '' then ConnectionPage.Values[0] := ParameterValue;
  if ConnectionPage.Values[0] = '' then ConnectionPage.Values[0] := 'http://localhost:4100';
  ParameterValue := InstallerParameter('APIURL');
  if ParameterValue <> '' then ConnectionPage.Values[0] := ParameterValue;

  ProfileValue := ReadInstallerProfileValue('realtimeUrl', '');
  ConnectionPage.Values[1] := ProfileValue;
  ParameterValue := ReadExistingConfigValue('realtimeUrl', '');
  if ParameterValue <> '' then ConnectionPage.Values[1] := ParameterValue;
  if ConnectionPage.Values[1] = '' then ConnectionPage.Values[1] := 'ws://localhost:4200';
  ParameterValue := InstallerParameter('REALTIMEURL');
  if ParameterValue <> '' then ConnectionPage.Values[1] := ParameterValue;

  ConnectionPage.Values[2] := ReadInstallerProfileValue('agentKey', '');
  ParameterValue := ReadExistingConfigValue('agentKey', '');
  if ParameterValue <> '' then ConnectionPage.Values[2] := ParameterValue;
  ParameterValue := InstallerParameter('AGENTKEY');
  if ParameterValue <> '' then ConnectionPage.Values[2] := ParameterValue;

  ConnectionPage.Values[3] := ReadExistingConfigValue('ffmpegPath', '');
  ParameterValue := InstallerParameter('FFMPEGPATH');
  if ParameterValue <> '' then ConnectionPage.Values[3] := ParameterValue;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    InstallAgentService;
  end;
end;
