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
Source: "{#StagingDir}\uninstall-package.ps1"; DestDir: "{app}"; Flags: ignoreversion

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\uninstall-package.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveRemotoAgentService"

[UninstallDelete]
Type: files; Name: "{app}\.remoto-agent.config.json"
Type: files; Name: "{app}\.remoto-agent.state.json"
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

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ApiUrl: string;
  AgentKey: string;
begin
  Result := True;
  if CurPageID <> ConnectionPage.ID then Exit;

  ApiUrl := Trim(ConnectionPage.Values[0]);
  AgentKey := Trim(ConnectionPage.Values[1]);

  if ((CompareText(Copy(ApiUrl, 1, 7), 'http://') <> 0) and
      (CompareText(Copy(ApiUrl, 1, 8), 'https://') <> 0)) then begin
    MsgBox('Informe uma URL iniciando com http:// ou https://.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if AgentKey = '' then begin
    MsgBox('Informe a chave do agente gerada no painel.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if HasInvalidInput(ApiUrl) or HasInvalidInput(AgentKey) then begin
    MsgBox('A URL e a chave nao podem conter aspas ou quebras de linha.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure InstallAgentService;
var
  PowerShellPath: string;
  ScriptPath: string;
  Parameters: string;
  ExecResult: Boolean;
begin
  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
  ScriptPath := ExpandConstant('{app}\install-package.ps1');
  Parameters := '-NoProfile -ExecutionPolicy Bypass -File ' + QuoteArgument(ScriptPath) +
    ' -ApiUrl ' + QuoteArgument(Trim(ConnectionPage.Values[0])) +
    ' -AgentKey ' + QuoteArgument(Trim(ConnectionPage.Values[1]));

  ExecResult := Exec(PowerShellPath, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ServiceInstallResult);
  if (not ExecResult) or (ServiceInstallResult <> 0) then begin
    MsgBox('O agente foi copiado, mas o servico nao pode ser iniciado. Codigo: ' +
      IntToStr(ServiceInstallResult) + '.', mbError, MB_OK);
  end;
end;

procedure InitializeWizard;
begin
  ConnectionPage := CreateInputQueryPage(wpSelectDir,
    'Conexao do agente',
    'Informe onde o agente deve se conectar',
    'Esses dados serao usados para registrar este computador no painel Remoto.');
  ConnectionPage.Add('URL da API:', False);
  ConnectionPage.Add('Chave do agente:', True);
  ConnectionPage.Values[0] := ExpandConstant('{param:APIURL|http://localhost:4100}');
  ConnectionPage.Values[1] := ExpandConstant('{param:AGENTKEY|}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    InstallAgentService;
  end;
end;
