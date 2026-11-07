# Segurança e privacidade dos dados (Fase 3)

- **O que é guardado:** leito + iniciais (validação recusa nome completo, prontuário/CPF), data/hora de nascimento opcional, rascunho do cálculo e histórico de prescrições salvas. Tudo no IndexedDB do aparelho (Dexie). Nenhum backend, nenhuma análise/telemetria.
- **PIN (opcional, 4–12 dígitos):** PBKDF2-HMAC-SHA256 (600.000 iterações, salt de 16 bytes) → chave AES-GCM 256 não extraível, só na memória. Cada gravação usa IV novo de 12 bytes; GCM detecta adulteração. Em claro ficam só ids aleatórios e datas de atualização (índices).
- **Bloquear = esquecer a chave** e limpar o estado da tela. Bloqueio ao sair do app ou após inatividade (preferência). Erros seguidos de PIN impõem espera.
- **Sem PIN os dados ficam legíveis** no aparelho; o app avisa na lista de pacientes e no backup.
- **Esqueceu o PIN = sem recuperação.** Só o backup + o mesmo PIN restaura.
- **Backup JSON:** mantém a cifra do PIN vigente (ou texto puro se não havia PIN, com aviso). Importar mescla (paciente mais novo vence; histórico existente é mantido) e recifra com o PIN local.
- **Limpeza automática (opcional):** apaga paciente + histórico sem atualização há N dias; roda ao abrir o app, inclusive bloqueado (usa o índice em claro).
- **Service worker:** só pré-cache de arquivos estáticos; dados de paciente nunca passam por cache de rede.
- **iOS:** o app instalado na Tela de Início tem armazenamento separado do Safari; o iOS pode limpar dados de sites sem uso em ~7 dias se não instalado/persistente. `navigator.storage.persist()` é pedido no primeiro salvamento. Faça backups.
