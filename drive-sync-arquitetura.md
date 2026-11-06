# Drive Sync --- Documento de visão e arquitetura

## 1. Objetivo

Desenvolver um plugin para o Obsidian que sincronize um Vault local com
uma pasta remota no Google Drive.

A proposta inicial é oferecer uma experiência semelhante a comandos
básicos do Git:

-   **Pull:** trazer alterações do Google Drive para o Vault local.
-   **Push:** enviar alterações locais para o Google Drive.
-   **Status:** mostrar arquivos novos, modificados, excluídos e
    possíveis conflitos.
-   **Sync:** comparar os dois lados e aplicar as alterações possíveis,
    respeitando as regras de conflito.

O Google Drive será utilizado como armazenamento remoto. Cada
dispositivo continuará mantendo sua própria cópia local do Vault.

## 2. Escopo e evolução

### MVP --- sincronização manual

A primeira versão deve priorizar:

-   Autenticação da conta Google.
-   Seleção ou configuração de uma pasta remota no Drive.
-   Primeiro Pull e primeiro Push.
-   Comparação entre os estados local e remoto.
-   Detecção de arquivos novos, modificados e excluídos.
-   Identificação de conflitos.
-   Preservação de dados em situações de conflito.
-   Exibição do status da sincronização.

### Evoluções futuras

-   Sincronização automática.
-   Sincronização periódica e/ou disparada por eventos.
-   Notificações de alterações remotas.
-   Histórico de versões, se fizer sentido para o produto.
-   Configurações para ignorar arquivos e pastas.
-   Melhorias de desempenho para Vaults grandes.

**Diretriz:** a sincronização automática não é prioridade do MVP, mas a
arquitetura deve nascer preparada para recebê-la sem exigir a
reimplementação do motor de sincronização.

## 3. Arquitetura proposta

Separar a interface, o motor de sincronização e os provedores de
armazenamento.

``` text
Obsidian Plugin
│
├── Interface / Commands
│   ├── Pull
│   ├── Push
│   ├── Status
│   └── Sync
│
├── Sync Engine
│   ├── Change Detector
│   ├── Sync Planner
│   ├── Conflict Resolver
│   └── Sync Lock
│
├── State Repository
│   └── Estado persistente da sincronização
│
├── Storage Providers
│   ├── Local Vault
│   └── Google Drive
│
└── Future: Sync Scheduler
    ├── Periodic Sync
    └── Event-driven Sync
```

O **Sync Engine** deve concentrar a lógica de comparação e
sincronização. Os comandos manuais e o futuro Scheduler apenas solicitam
operações ao motor.

O Scheduler não deve conter regras próprias de comparação, transferência
ou resolução de conflitos.

## 4. Separação de responsabilidades

Sugestão inicial de módulos:

  -----------------------------------------------------------------------
  Módulo                              Responsabilidade
  ----------------------------------- -----------------------------------
  `GoogleAuthService`                 Autenticação OAuth 2.0 e renovação
                                      de credenciais

  `GoogleDriveProvider`               Listar, baixar, enviar e excluir
                                      arquivos no Drive

  `VaultProvider`                     Ler, gravar, listar, renomear e
                                      excluir arquivos locais

  `SyncEngine`                        Orquestrar o processo de
                                      sincronização

  `ChangeDetector`                    Identificar diferenças entre o
                                      estado conhecido, local e remoto

  `SyncPlanner`                       Determinar quais ações devem ser
                                      executadas

  `ConflictResolver`                  Detectar e tratar alterações
                                      concorrentes

  `SyncStateRepository`               Persistir IDs, hashes, tokens e
                                      metadados da sincronização

  `SyncScheduler`                     Futuramente disparar sincronizações
                                      automáticas
  -----------------------------------------------------------------------

O motor deve depender de abstrações de armazenamento, e não diretamente
da API do Google Drive. Isso permite adicionar outros provedores no
futuro.

Exemplo conceitual:

``` typescript
interface RemoteStorage {
  listFiles(): Promise<RemoteFile[]>;
  downloadFile(id: string): Promise<ArrayBuffer>;
  uploadFile(file: RemoteFile): Promise<void>;
  deleteFile(id: string): Promise<void>;
}
```

A interface real poderá evoluir para suportar paginação, atualização de
metadados, movimentação, renomeação e operações incrementais.

## 5. Modelo de comparação

O mecanismo deve comparar três estados:

1.  **Base conhecida:** última versão sincronizada com sucesso.
2.  **Estado local:** conteúdo atual do Vault.
3.  **Estado remoto:** conteúdo atual no Google Drive.

Exemplos de decisão:

  Situação                              Ação esperada
  ------------------------------------- ------------------------------------------------
  Só o arquivo local mudou              Push
  Só o arquivo remoto mudou             Pull
  Local e remoto mudaram desde a base   Conflito
  Nenhum dos lados mudou                Nenhuma ação
  Arquivo novo localmente               Push
  Arquivo novo remotamente              Pull
  Exclusão em um lado                   Propagar exclusão conforme a política definida

A comparação deve utilizar hashes de conteúdo, como SHA-256, para
identificar alterações reais. Datas de modificação podem ajudar na
análise, mas não devem ser a única fonte de verdade.

## 6. Estado persistente

Manter um estado local persistente da sincronização. Uma possibilidade é
armazená-lo na pasta de dados do plugin, dentro de `.obsidian/plugins/`.

Exemplo conceitual:

``` json
{
  "remoteFolderId": "google-drive-folder-id",
  "lastSync": "2026-11-05T20:00:00Z",
  "files": {
    "Anotacoes/estudo.md": {
      "remoteId": "google-drive-file-id",
      "localHash": "sha256...",
      "remoteHash": "sha256..."
    }
  }
}
```

O formato definitivo deve contemplar, conforme necessário:

-   Caminho relativo no Vault.
-   ID do arquivo no Drive.
-   Hash do conteúdo sincronizado.
-   Metadados relevantes.
-   Estado de exclusão (tombstone), quando necessário.
-   Token de alterações do Google Drive.
-   Versão do formato do próprio arquivo de estado.

O estado precisa sobreviver ao fechamento e à reabertura do Obsidian.

## 7. Conflitos e proteção de dados

Um conflito ocorre quando o mesmo arquivo é alterado localmente e
remotamente desde a última sincronização bem-sucedida.

Política inicial recomendada:

-   Não sobrescrever silenciosamente uma das versões.
-   Preservar o conteúdo conflitante.
-   Informar o usuário sobre o conflito.
-   Permitir resolução manual ou geração de uma cópia de conflito.

A estratégia **last write wins** não deve ser adotada como padrão, pois
pode causar perda de anotações.

Exclusões também exigem cuidado: uma exclusão local não pode ser
confundida com um arquivo que ainda não foi baixado. O estado
persistente deve permitir distinguir exclusão intencional de ausência de
informação.

## 8. Requisitos de robustez

A arquitetura deve prever desde o início:

### Sync Lock

Impedir operações de sincronização concorrentes, como um Push manual
iniciado enquanto outro Sync está em execução.

### Idempotência

Repetir uma operação não deve causar corrupção, duplicação de arquivos
ou efeitos inesperados.

### Prevenção de ciclos

Diferenciar alterações feitas pelo usuário das alterações aplicadas pelo
próprio plugin. Isso será especialmente importante quando eventos do
Vault forem usados para disparar sincronizações automáticas.

### Operações seguras

Considerar falhas parciais de rede, interrupções durante upload ou
download, paginação e retomada de operações. Atualizar a base de
sincronização somente depois que as operações correspondentes forem
concluídas com sucesso.

### Tipos de arquivo

Não limitar o projeto a Markdown. O Vault pode conter imagens, PDFs,
áudio, vídeo e outros anexos. A comparação e a transferência devem
preservar arquivos binários.

## 9. Integração com o Obsidian

Utilizar as APIs oficiais do Obsidian para interagir com o Vault, em
especial `Vault` e `DataAdapter`, evitando depender diretamente de
caminhos e APIs específicas do sistema operacional.

Eventos do Vault, como criação, modificação, exclusão e renomeação,
poderão ser aproveitados futuramente para detectar alterações locais.

Na sincronização automática, aplicar debounce e outras proteções para
não iniciar uploads a cada pequena alteração ou enquanto um arquivo
ainda está sendo editado.

## 10. Integração com Google Drive

Utilizar a Google Drive API v3.

Recursos relevantes:

  Operação                            Recurso
  ----------------------------------- -----------------------------
  Listar arquivos                     `files.list`
  Baixar arquivo                      `files.get`
  Criar arquivo                       `files.create`
  Atualizar arquivo                   `files.update`
  Excluir arquivo                     `files.delete`
  Consultar alterações                `changes.list`
  Obter token inicial de alterações   `changes.getStartPageToken`

Para sincronizações posteriores, utilizar o mecanismo de alterações do
Drive e persistir o token retornado. A primeira sincronização deverá
fazer uma varredura completa.

Para autenticação, utilizar OAuth 2.0 apropriado para aplicação pública.
Não embutir um `client_secret` no código distribuído do plugin. Avaliar
os escopos mínimos necessários para acessar somente os arquivos e pastas
relevantes.

A API também oferece notificações por `changes.watch`, mas elas dependem
de um endpoint acessível publicamente. Para um plugin sem backend
próprio, o polling com `changes.list` é uma opção inicial mais simples.

## 11. Estratégia de implementação

Ordem sugerida:

1.  Criar a estrutura básica do plugin e os comandos.
2.  Definir as interfaces de armazenamento local e remoto.
3.  Implementar autenticação Google.
4.  Implementar operações básicas do Google Drive.
5.  Implementar listagem e leitura do Vault.
6.  Implementar o estado persistente e hashes.
7.  Implementar o Change Detector e o Sync Planner.
8.  Implementar Pull e Push.
9.  Implementar Status.
10. Implementar detecção e tratamento de conflitos.
11. Testar falhas, interrupções, exclusões e arquivos binários.
12. Preparar e implementar o Scheduler para sincronização automática em
    uma etapa posterior.

## 12. Princípios e decisões do projeto

-   TypeScript como linguagem principal.
-   Google Drive como primeiro provedor remoto.
-   Cada dispositivo mantém seu próprio Vault local.
-   Sincronização manual como prioridade do MVP.
-   Arquitetura preparada para sincronização automática.
-   Motor de sincronização independente do provedor remoto.
-   Estado de sincronização persistente.
-   Comparação baseada em conteúdo, com hashes.
-   Nenhuma sobrescrita silenciosa em conflitos.
-   Proteção contra operações concorrentes e falhas parciais.
-   Compatibilidade com arquivos binários e estrutura de pastas.
-   Preferência pelas APIs oficiais do Obsidian.

## 13. Documentação para consulta

-   [Google Drive API
    v3](https://developers.google.com/workspace/drive/api/reference/rest/v3)
-   [Google Drive --- Manage
    changes](https://developers.google.com/workspace/drive/api/guides/manage-changes)
-   [Obsidian --- Vault API](https://docs.obsidian.md/Plugins/Vault)
-   [Obsidian --- Events API](https://docs.obsidian.md/Plugins/Events)
-   [Obsidian --- Build a
    plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

------------------------------------------------------------------------

**Resumo:** o MVP será um sincronizador manual com Pull, Push, Status e
tratamento de conflitos. A arquitetura, entretanto, será construída em
torno de um Sync Engine reutilizável, com estado persistente, detecção
de alterações e provedores desacoplados. Assim, a sincronização
automática poderá ser adicionada futuramente como um mecanismo de
disparo do motor já existente.
