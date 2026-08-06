# Sistema Midas Wb - Planejamento Financeiro & Patrimônio (Simulado Acadêmico)

![Status do Build](https://img.shields.io/badge/Build-Est%C3%A1tico%20SPA-00E676?style=for-the-badge)
![Arquitetura](https://img.shields.io/badge/Arquitetura-Offline%20First%20%7C%20Client--Side-3B82F6?style=for-the-badge)
![Tecnologia](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%20%2B%20Vite-61DAFB?style=for-the-badge)
![Banco de Dados](https://img.shields.io/badge/Persist%C3%AAncia-IndexedDB%20%2F%20Dexie.js-F59E0B?style=for-the-badge)
![Segurança](https://img.shields.io/badge/Seguran%C3%A7a-AES--256%20CryptoJS-9C27B0?style=for-the-badge)

---

## 1. Resumo & Proposta Acadêmica

O **Midas Wb** é uma aplicação web profissional de gerenciamento financeiro pessoal e controle de patrimônio misto (ativos tradicionais da Bolsa de Valores, Renda Fixa, Contas Bancárias, Moedas Fiduciárias e criptoativos com **Pools de Liquidez DeFi**). 

Trata-se de um **trabalho de faculdade (simulado acadêmico)** projetado sob alto rigor técnico e engenharia de software de vanguarda. Toda a aplicação opera **100% no lado do cliente (client-side)** dentro do navegador do usuário, com arquitetura **Offline-First**, sem nenhuma dependência de servidores backend proprietários, APIs pagas ou bancos de dados remotos na nuvem. A aplicação é compilada em um pacote estático de alta performance centrado no arquivo `index.html`.

O design visual segue o padrão **Premium Modern Dark/Light Mode**, com influências estéticas de aplicações como *Monarch Money, Delta Investment Tracker, Kubera* e *CoinStats*, utilizando efeitos de *Glassmorphism*, gradientes suaves, animações reativas e paleta de cores harmonizada.

---

## 2. Stack Tecnológica Permitida (100% Gratuita & Open-Source) & Justificativas

A seleção tecnológica foi guiada pelos princípios de **SOLID, Clean Code, DRY** e máxima separação de responsabilidades (Apresentação, Estado Global e Serviços/Persistência):

| Componente | Tecnologia Open-Source | Justificativa Arquitetural |
| :--- | :--- | :--- |
| **Core & UI** | **React (com TypeScript rigoroso)** | Framework declarativo líder na indústria, conferindo segurança de tipagem contra falhas em tempo de compilação, manutenibilidade do código e alta modularidade com Hooks. |
| **Bundler** | **Vite** | Empacotador de última geração baseado em ESM rápido, capaz de gerar builds estáticas altamente otimizadas focadas no ponto de entrada `index.html`. |
| **Estilização** | **TailwindCSS + Lucide Icons** | Estilização por classes utilitárias de alta performance, permitindo design systems responsivos com Modo Escuro (`darkMode: 'class'`) e efeitos de vidro sem sobrecarga de CSS. |
| **Estado Global** | **Zustand** | Gerenciador de estado leve (~1KB), reativo e desprovido do boilerplate do Redux, perfeito para gerenciar temas, modo privacidade e moedas base em tempo real. |
| **Gráficos & Dashboards** | **Apache ECharts (`echarts-for-react`)** | Biblioteca de visualização de dados financeira altamente personalizável, gerando gráficos de alocação (pizza/rosquinha) e fluxo de aportes com animações fluidas em Canvas/SVG. |
| **Tabelas Avançadas** | **TanStack Table v8** | Motor headless de processamento de tabelas com suporte a ordenação por colunas, filtros globais instantâneos e paginação no cliente sem atrasos ou lag. |
| **Formulários & Schemas** | **React Hook Form + Zod** | Validação robusta de esquemas estritamente tipados com Zod e formulários sem re-renderizações desnecessárias da UI. |
| **Banco Local** | **Dexie.js (Wrapper IndexedDB)** | Persistência assíncrona robusta rodando diretamente no mecanismo relacional/transacional do navegador (IndexedDB), provendo capacidades offline absolutas e consultas reativas via `useLiveQuery`. |
| **Segurança & Criptografia** | **Crypto-JS (AES-256)** | Algoritmo de criptografia de chave simétrica de padrão militar executado client-side para proteção na exportação e importação dos backups em `.json`. |

---

## 3. Integração de APIs Gratuitas & Política de Cache (Offline-First)

Para possibilitar conversões cambiais automáticas e métricas em tempo real sem custos de servidores de back-end, o sistema integra duas APIs públicas e gratuitas de cotação:
1. **CoinGecko API (Plano Gratuito Public):** Consulta de cotações em Real/Dólar de ativos cripto (BTC, ETH, SOL, USDC) e variação percentual nas últimas 24 horas.
2. **AwesomeAPI Economia (Gratuita):** Consulta ao vivo dos pares fiduciários Dólar/Real (`USD-BRL`), Euro/Real (`EUR-BRL`) e Bitcoin/Real.

### Política de Fallback Gracioso e Cache Local
O serviço de API (`/src/services/api.ts`) é blindado com um padrão **Circuit Breaker & Fallback Offline**:
- Toda vez que uma requisição HTTP via `fetch` obtém sucesso, as taxas atualizadas são persistidas na tabela `ratesCache` do IndexedDB com carimbo de tempo (*timestamp*).
- Se o usuário estiver **sem conexão de internet (Offline)** ou se as APIs públicas atingirem o limite de requisições temporário (*Rate Limiting* / Timeout de 6s), o sistema **intercepta silenciosamente a falha e serve as cotações em cache** do IndexedDB. 
- A interface de usuário adapta seu badge superior informando graciosamente: `Modo Offline (Cache IndexedDB)` sem emitir alertas de falha que degradem a experiência.

---

## 4. Estrutura do Banco de Dados Local (IndexedDB / Dexie.js Schemas)

O banco de dados transacional é inicializado sob o namespace `MidasWbDB` e estruturado nos seguintes esquemas:

```typescript
this.version(1).stores({
  accounts: '++id, name, type, currency',
  transactions: '++id, accountId, destinationAccountId, date, category, type, goalId',
  goals: '++id, title, accountId, deadline',
  investments: '++id, ticker, type, accountId',
  defiPools: '++id, protocol, pair',
  ratesCache: 'id'
});
```

### Relacionamentos e Módulos
1. **`accounts`**: Armazena as contas bancárias, corretoras, caixas físicas e carteiras cripto (ex: Nubank, XP, Binance, Ledger).
2. **`transactions`**: Contabilidade de Entradas (`income`), Saídas (`expense`) e Transferências Interbancárias (`transfer`). Ao adicionar uma transação, o sistema computa uma transação real no banco alterando reativamente os saldos das contas envolvidas.
3. **`goals`**: Sistema de "Caixinhas", reservando saldos virtualizados dentro das contas liquida sem comprometer a estrutura das transações.
4. **`investments`**: Ativos tradicionais (Ações, ETFs, Renda Fixa) com acompanhamento de Yield % e lucro/perda acumulada.
5. **`defiPools`**: Posições em Automated Market Makers (AMM como Uniswap e Raydium) com cálculo reativo de APR, APY e recompensas pendentes para colheira (Harvest).
6. **`ratesCache`**: Armazem chave-valor de resgate das cotações cambiais de emergência/offline.

---

## 5. Destaque Técnico: Simulador Matemático de Impermanent Loss em DeFi

No módulo de Investimentos & DeFi, o sistema apresenta um **Laboratório Matemático Interativo de Impermanent Loss** (Perda Impermanente). Em protocolos DeFi de Automated Market Makers (AMM) sob produto constante ($X \times Y = K$), a variação relativa entre o preço de dois ativos gera divergência no valor do pool de liquidez em relação ao simples armazenamento na carteira física (*HODL*).

O motor de cálculo do Midas Wb (`/src/utils/calculators.ts`) modela essa variação utilizando a fórmula de desvio harmônico em relação à razão de preço $P = \frac{\text{PreçoNovo A} / \text{PreçoNovo B}}{\text{PreçoInicial A} / \text{PreçoInicial B}}$:

$$\text{Impermanent Loss (IL)} = \left( \frac{2 \sqrt{P}}{1 + P} \right) - 1$$

O usuário pode alterar os preços de ativos como ETH e USDC de forma reativa no navegador e verificar simultaneamente o impacto visual no patrimônio HODL versus patrimônio em Staking AMM.

---

## 6. Guia de Instalação e Execução em Ambiente de Desenvolvimento

Para rodar o projeto localmente em sua máquina para fins de desenvolvimento, modificação ou teste:

### Pré-requisitos
- **Node.js** (Versão 18 ou superior recomendada)
- **NPM** (ou Yarn/Pnpm)

### Passo a Passo
1. Abra o terminal na pasta raiz do projeto:
   ```bash
   cd "C:\Users\Jotta\Desktop\Projetos\Projetos IA\Projeto Midas Wb"
   ```
2. Instale todas as dependências do projeto:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento reativo do Vite:
   ```bash
   npm run dev
   ```
4. Abra o navegador no endereço exibido (geralmente `http://localhost:5173`). O sistema populará automaticamente o banco com dados simulada de demonstração caso esteja rodando pela primeira vez!

---

## 7. Guia de Compilação Estática para Produção (Build)

Para gerar os arquivos estáticos autocontidos que podem ser hospedados gratuitamente no **GitHub Pages, Vercel, Netlify** ou simplesmente abertos via servidor local:

1. No terminal, execute o comando de build otimizado:
   ```bash
   npm run build
   ```
2. O bundler compilará e gerará o diretório `/dist/` centrado em:
   - `dist/index.html` (Ponto de entrada único e principal)
   - `dist/assets/*` (Pacotes Javascript, CSS e ícones altamente otimizados e com hashing para cache dos navegadores).

O pacote final não requer nenhum software especial no back-end — todo o processamento patrimonial é efetuado com segurança dentro da Engine JavaScript do navegador do cliente.

---

## 8. Backup e Segurança Local (Criptografia AES-256)

Na tela **Segurança & Backup** do sistema, o usuário pode:
- **Exportar Banco (.json):** Baixa um backup completo de sua carteira e histórico de transações e caixinhas. Se a chave de proteção for preenchida, o arquivo salvo no HD do usuário é transformado em uma string ilegível codificada em Base64 através da biblioteca **Crypto-JS sob padrão AES-256**.
- **Restaurar Banco:** O upload do arquivo restaura as tabelas do IndexedDB com sucesso. Caso o arquivo possua o selo de criptografia, a senha AES-256 é verificada em tempo de execução antes da injeção de dados.
- **Botão Seed Demo:** Para facilitar apresentações para a banca da faculdade, o botão *"Carregar Dados de Demonstração (Seed Demo)"* repopula o sistema a qualquer momento com um portfólio completo e diverso pronto para ser exibido.
