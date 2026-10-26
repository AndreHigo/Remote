# Entrega 105 - Edicao de dados de usuario

O painel administrativo agora permite editar nome e email de usuarios gerenciados diretamente na lista de acesso. A alteracao usa a API existente, valida os campos no cliente e atualiza a lista sem recarregar a pagina.

O proprio usuario logado permanece protegido nesta acao porque a API revoga a versao da sessao ao alterar qualquer usuario. Para editar o administrador atual sem derrubar a sessao, deve ser usada uma sessao administrativa separada.

Acoes administrativas disponiveis no painel: criar usuario, editar nome/email, alterar funcao, redefinir senha, bloquear/ativar conta, cadastrar cliente, editar/excluir cliente quando elegivel, criar/revogar chave de agente, arquivar/restaurar/excluir dispositivo e configurar 2FA.
