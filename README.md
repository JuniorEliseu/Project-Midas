[🇺🇸 English](#english-version) | [🇧🇷 Português](#versão-em-português)

<a name="versão-em-português"></a>
# Sistema Midas Wb - Planejamento Financeiro & Patrimônio

![Status do Build](https://img.shields.io/badge/Build-Est%C3%A1tico%20SPA-00E676?style=for-the-badge)
![Arquitetura](https://img.shields.io/badge/Arquitetura-Offline%20First%20%7C%20Client--Side-3B82F6?style=for-the-badge)
![Tecnologia](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%20%2B%20Vite-61DAFB?style=for-the-badge)
![Banco de Dados](https://img.shields.io/badge/Persist%C3%AAncia-IndexedDB%20%2F%20Dexie.js-F59E0B?style=for-the-badge)
![Segurança](https://img.shields.io/badge/Seguran%C3%A7a-AES--256%20CryptoJS-9C27B0?style=for-the-badge)

---

## 1. Resumo & Proposta do Projeto

O **Midas Wb** é uma aplicação web profissional de gerenciamento financeiro pessoal e controle de patrimônio misto (ativos tradicionais da Bolsa de Valores, Renda Fixa, Contas Bancárias, Moedas Fiduciárias e criptoativos com **Pools de Liquidez DeFi**). 

Trata-se de um **projeto pessoal** projetado sob alto rigor técnico e engenharia de software de vanguarda, **desenvolvido com o auxílio de Inteligência Artificial**. Toda a aplicação opera **100% no lado do cliente (client-side)** dentro do navegador do usuário, com arquitetura **Offline-First**, sem nenhuma dependência de servidores backend proprietários, APIs pagas ou bancos de dados remotos na nuvem. A aplicação é compilada em um pacote estático de alta performance centrado no arquivo `index.html`.

O design visual segue o padrão **Premium Modern Dark/Light Mode**, com influências estéticas de aplicações como *Monarch Money, Delta Investment Tracker, Kubera* e *CoinStats*, utilizando efeitos de *Glassmorphism*, gradientes suaves, animações reativas e paleta de cores harmonizada.

---

## 2. Funcionalidades de Destaque

- **Módulo de Investimentos DeFi & Simulador de Impermanent Loss**: Laboratório matemático interativo para cálculo reativo de *Impermanent Loss* sob produto constante ($X \times Y = K$) em protocolos de Automated Market Makers (AMM).
- **Caixinhas Multi-Contas (Objetivos Patrimoniais)**: Um sofisticado sistema de delegação de saldos. Ele permite que você "reserve" fundos de múltiplas contas (ex: R$ 500 do Nubank e R$ 200 da XP) para uma mesma Caixinha, rastreando perfeitamente a origem dos valores sem remover o dinheiro de sua conta base.
- **Proteção Automática de Gastos & Saldo Livre**: Ao inserir uma transação de saída que exceda seu "Saldo Livre" (saldo total subtraindo o dinheiro travado em caixinhas), o motor do Midas emitirá um alerta inteligente e, se aprovado, deduzirá as alocações da respectiva caixinha de forma automática, garantindo consistência matemática de mão dupla.
- **Integração de Cotações Offline-First**: O sistema consome APIs gratuitas (CoinGecko e AwesomeAPI) para puxar taxas do Dólar, Euro e Criptomoedas ao vivo. Conta com um modelo de **Circuit Breaker & Fallback Offline** salvando as cotações no IndexedDB para uso se você perder a conexão com a internet.

---

## 3. Stack Tecnológica Permitida (100% Gratuita & Open-Source) & Justificativas

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
2. **`transactions`**: Contabilidade de Entradas, Saídas e Transferências Interbancárias. Possui proteção de fluxo que analisa e abate saldos "reservados" em caixinhas atreladas.
3. **`goals`**: Sistema de Caixinhas. Utiliza um array de alocações interno para identificar com precisão qual conta injetou fundos nelas.
4. **`investments`**: Ativos tradicionais (Ações, ETFs, Renda Fixa) com acompanhamento de Yield % e lucro/perda acumulada.
5. **`defiPools`**: Posições em AMM como Uniswap e Raydium.
6. **`ratesCache`**: Armazem chave-valor de resgate das cotações cambiais de emergência/offline.

---

## 5. Guia de Instalação e Execução

Para rodar o projeto localmente em sua máquina, você tem duas opções:

### Pré-requisitos
- **Node.js** (Versão 18 ou superior recomendada instalada no Windows)

### Método 1: Iniciador Automático (Recomendado / Mais Fácil)
A maneira mais rápida de rodar a aplicação:
1. Navegue até a pasta principal do projeto no seu computador.
2. Dê **dois cliques** no arquivo `iniciar.bat`.
3. Um terminal se abrirá sozinho. Ele irá instalar as dependências necessárias (se for a primeira vez) e, em seguida, **abrirá a aplicação automaticamente no seu navegador padrão**.

### Método 2: Pelo Terminal (Para Desenvolvedores)
Se preferir rodar manualmente por linha de comando:
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
4. Abra o navegador no endereço exibido (geralmente `http://localhost:5173` ou `http://localhost:5174`). O sistema populará automaticamente o banco com dados simulados de demonstração caso esteja rodando pela primeira vez!

---

## 6. Guia de Compilação Estática para Produção (Build)

Para gerar os arquivos estáticos autocontidos que podem ser hospedados gratuitamente no **GitHub Pages, Vercel, Netlify** ou simplesmente abertos via servidor local:

1. No terminal, execute o comando de build otimizado:
   ```bash
   npm run build
   ```
2. O bundler compilará e gerará o diretório `/dist/` centrado no `index.html`. 
O pacote final não requer nenhum software especial no back-end — todo o processamento patrimonial é efetuado com segurança dentro da Engine JavaScript do navegador do cliente.

---

## 7. Backup e Segurança Local (Criptografia AES-256)

Na tela **Segurança & Backup** do sistema, o usuário pode:
- **Exportar Banco (.json):** Baixa um backup completo de sua carteira e histórico de transações e caixinhas. Se a chave de proteção for preenchida, o arquivo salvo no HD do usuário é transformado em uma string ilegível codificada em Base64 através da biblioteca **Crypto-JS sob padrão AES-256**.
- **Restaurar Banco:** O upload do arquivo restaura as tabelas do IndexedDB com sucesso, requerendo a senha de injeção em caso de backups blindados.
- **Botão Seed Demo:** Para facilitar testes e visualização prévia, o botão *"Carregar Dados de Demonstração (Seed Demo)"* repopula o sistema a qualquer momento.

---
---

<a name="english-version"></a>
# Midas Wb System - Financial & Wealth Planning

![Build Status](https://img.shields.io/badge/Build-Static%20SPA-00E676?style=for-the-badge)
![Architecture](https://img.shields.io/badge/Architecture-Offline%20First%20%7C%20Client--Side-3B82F6?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-React%2018%20%2B%20TypeScript%20%2B%20Vite-61DAFB?style=for-the-badge)
![Database](https://img.shields.io/badge/Persistence-IndexedDB%20%2F%20Dexie.js-F59E0B?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-AES--256%20CryptoJS-9C27B0?style=for-the-badge)

---

## 1. Summary & Project Proposal

**Midas Wb** is a professional web application for personal financial management and mixed wealth tracking (traditional stock market assets, fixed income, bank accounts, fiat currencies, and crypto assets including **DeFi Liquidity Pools**).

This is a **personal project** designed under strict technical standards and cutting-edge software engineering, **developed with the assistance of Artificial Intelligence**. The entire application runs **100% client-side** inside the user's browser, adopting an **Offline-First** architecture. It relies on no proprietary backend servers, paid APIs, or cloud remote databases. The app compiles into a high-performance static bundle centered on `index.html`.

The visual design follows a **Premium Modern Dark/Light Mode** standard, drawing aesthetic influence from apps like *Monarch Money, Delta Investment Tracker, Kubera*, and *CoinStats*, featuring Glassmorphism, smooth gradients, reactive animations, and a harmonized color palette.

---

## 2. Highlighted Features

- **DeFi Investments Module & Impermanent Loss Simulator**: An interactive mathematical lab for reactive calculation of *Impermanent Loss* under constant product formula ($X \times Y = K$) in Automated Market Maker (AMM) protocols.
- **Multi-Account Goals (Wealth Stashes)**: A sophisticated balance delegation system. It allows you to "reserve" funds from multiple distinct accounts (e.g., $500 from Bank A and $200 from Broker B) towards a single Goal, perfectly tracking fund origins without physically withdrawing from the base accounts.
- **Automatic Expense & Free Balance Protection**: When inputting an outgoing transaction that exceeds your "Free Balance" (total balance minus money locked in Goals), the Midas engine issues an intelligent alert. If approved, it automatically deduces the goal allocations attached to that account, ensuring strict two-way mathematical consistency.
- **Offline-First Exchange Rates Integration**: The system consumes free APIs (CoinGecko and AwesomeAPI) to fetch live Dollar, Euro, and Crypto rates. It uses a **Circuit Breaker & Offline Fallback** model, saving quotes into IndexedDB to be used if internet connection is lost.

---

## 3. Permitted Tech Stack (100% Free & Open-Source) & Justifications

The technology selection was guided by **SOLID, Clean Code, DRY** principles, maximizing the separation of concerns (Presentation, Global State, and Services/Persistence):

| Component | Open-Source Technology | Architectural Justification |
| :--- | :--- | :--- |
| **Core & UI** | **React (with strict TypeScript)** | Industry-leading declarative framework, providing type safety, code maintainability, and high modularity via Hooks. |
| **Bundler** | **Vite** | Next-generation ESM-based bundler, capable of outputting highly optimized static builds. |
| **Styling** | **TailwindCSS + Lucide Icons** | High-performance utility-class styling, enabling responsive design systems with Dark Mode (`darkMode: 'class'`) and glass effects without CSS bloat. |
| **Global State** | **Zustand** | Lightweight, reactive state manager without Redux's boilerplate, perfect for real-time themes and base currency states. |
| **Charts & Dashboards** | **Apache ECharts (`echarts-for-react`)** | Highly customizable financial data visualization library generating fluid allocation pie/donut charts and flow charts in Canvas/SVG. |
| **Advanced Tables** | **TanStack Table v8** | Headless table processing engine supporting column sorting, global filters, and client-side pagination with zero lag. |
| **Forms & Schemas** | **React Hook Form + Zod** | Robust strict-typed schema validation and form handling without unnecessary UI re-renders. |
| **Local Database** | **Dexie.js (IndexedDB Wrapper)** | Robust asynchronous persistence running directly in the browser's relational engine (IndexedDB), granting absolute offline capabilities and reactive queries via `useLiveQuery`. |
| **Security & Crypto** | **Crypto-JS (AES-256)** | Military-grade symmetric key encryption executed client-side to protect `.json` backup exports and imports. |

---

## 4. Local Database Structure (IndexedDB / Dexie.js Schemas)

The transactional database is initialized under the `MidasWbDB` namespace and structured with the following schemas:

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

### Relationships and Modules
1. **`accounts`**: Stores bank accounts, brokerages, cash stashes, and crypto wallets.
2. **`transactions`**: Accounting for Incomes, Expenses, and Interbank Transfers. Features flow protection that analyzes and deducts "reserved" balances in linked goals.
3. **`goals`**: Goal system (Stashes). Uses an internal allocation array to precisely identify which accounts injected funds into them.
4. **`investments`**: Traditional assets (Stocks, ETFs, Fixed Income) tracking Yield % and accumulated profit/loss.
5. **`defiPools`**: Positions in AMMs like Uniswap and Raydium.
6. **`ratesCache`**: Key-value store for emergency/offline currency exchange rates recovery.

---

## 5. Installation and Execution Guide

To run the project locally on your machine, you have two options:

### Prerequisites
- **Node.js** (Version 18 or higher recommended on Windows)

### Method 1: Automatic Launcher (Recommended / Easiest)
The fastest way to run the application:
1. Navigate to the project's root folder on your computer.
2. **Double-click** the `iniciar.bat` file.
3. A terminal will automatically open, install the necessary dependencies (if it's the first time), and then **automatically open the application in your default browser**.

### Method 2: Via Terminal (For Developers)
If you prefer running it manually via command line:
1. Open the terminal in the project's root folder:
   ```bash
   cd "C:\Users\Jotta\Desktop\Projetos\Projetos IA\Projeto Midas Wb"
   ```
2. Install all project dependencies:
   ```bash
   npm install
   ```
3. Start Vite's reactive development server:
   ```bash
   npm run dev
   ```
4. Open the browser at the displayed address (usually `http://localhost:5173` or `http://localhost:5174`). The system will automatically populate the database with mock demo data if running for the first time!

---

## 6. Static Build Guide (Production)

To generate self-contained static files that can be hosted for free on **GitHub Pages, Vercel, Netlify**, or simply opened via a local server:

1. In the terminal, run the optimized build command:
   ```bash
   npm run build
   ```
2. The bundler will compile and generate the `/dist/` directory centered on `index.html`.
The final package requires no special backend software — all wealth processing is securely executed within the client's browser JavaScript Engine.

---

## 7. Backup and Local Security (AES-256 Encryption)

On the **Security & Backup** screen, the user can:
- **Export Database (.json):** Downloads a full backup of their wallet, transaction history, and goals. If the protection key is filled, the file saved on the user's hard drive is transformed into an unreadable Base64 string encoded by the **Crypto-JS library under AES-256 standards**.
- **Restore Database:** Uploading the file successfully restores the IndexedDB tables, requiring the injection password for shielded backups.
- **Seed Demo Button:** To facilitate testing and preview, the *"Load Demo Data (Seed Demo)"* button repopulates the system at any time.
