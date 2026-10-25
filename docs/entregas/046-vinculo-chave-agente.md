# Entrega 046 - Vinculo da chave de agente ao computador

## Problema

Uma chave criada no painel para um cliente continuava válida para registrar vários `remoteId`. Isso ampliava o impacto de uma chave copiada ou reutilizada fora da instalação pretendida.

## Comportamento atual

- a primeira chamada de cadastro reserva a chave para o `remoteId` informado;
- o mesmo computador pode repetir cadastro, heartbeat, inventario e sessoes normalmente;
- outra maquina recebe `409` e precisa de uma nova chave;
- ao mover o computador para outro cliente, a associacao da chave acompanha o dispositivo;
- ao excluir o computador, as chaves vinculadas sao revogadas e desvinculadas;
- o painel mostra se a chave ainda aguarda o primeiro cadastro ou ja esta vinculada.

## Migracao

A migracao `0007_bind_agent_key_to_device` adiciona `boundRemoteId` em `AgentEnrollmentKey`. Chaves existentes permanecem sem vinculo ate o proximo cadastro.

## Limite

O vinculo usa o `remoteId` do agente como ancora operacional. A identidade forte do hardware continua sendo usada para evitar duplicidade de dispositivos, mas a homologacao de troca de placa, reinstalacao e rotacao assistida ainda precisa ser exercida em maquinas reais.
