# 📦 StockPro — Sistema de Gerenciamento de Estoque

> Sistema web completo para controle de estoque, desenvolvido com Python/Flask, SQLite e JavaScript puro. Interface moderna com tema escuro, autenticação por sessão e painel de alertas em tempo real.

![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Como Usar](#-como-usar)
- [Usuários e Permissões](#-usuários-e-permissões)
- [API Endpoints](#-api-endpoints)
- [Banco de Dados](#-banco-de-dados)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 🎯 Sobre o Projeto

O **StockPro** é uma solução simples, leve e funcional para pequenas e médias empresas que precisam controlar seu estoque sem depender de sistemas pesados ou caros.

**Destaques:**
- ✅ Sem dependências externas além do Flask
- ✅ Banco de dados local em SQLite — zero configuração
- ✅ Interface responsiva que funciona em desktop e mobile
- ✅ Alertas automáticos de estoque baixo/crítico
- ✅ Controle de acesso por perfil (Admin / Gerente / Operador)
- ✅ Pronto para rodar com 3 comandos

---

## ✨ Funcionalidades

### 🏠 Dashboard
- KPIs em tempo real: total de produtos, valor em estoque, fornecedores, alertas
- Gráfico de barras com entradas e saídas dos últimos 7 dias
- Painel lateral de alertas de estoque crítico/baixo
- Feed das últimas movimentações com usuário responsável

### 🛍️ Produtos
- Cadastro completo com código único, nome, descrição, categoria e fornecedor
- Controle de preço de custo e preço de venda
- Estoques mínimo, máximo e atual com barra visual de nível
- Localização física (ex: Prateleira A3)
- Status automático: **OK** / **Baixo** / **Crítico**
- Entrada rápida de estoque direto da lista de produtos

### 🏭 Fornecedores
- Cadastro com CNPJ, e-mail, telefone e endereço completo
- Vínculo direto com produtos cadastrados

### 🏷️ Categorias
- Organização de produtos por categorias customizáveis

### 📥 Entrada de Estoque
- Registro com produto, quantidade, preço unitário e nota fiscal
- Atualização automática do estoque ao confirmar

### 📤 Saída de Estoque
- Registro de saída com destino/cliente
- Validação automática — bloqueia saída maior que o estoque disponível

### 📋 Histórico
- Log completo de todas as movimentações (entrada, saída, ajuste)
- Exibe tipo, produto, quantidade, valor total, data e operador responsável

### 📊 Relatórios
| Relatório | Descrição |
|-----------|-----------|
| Estoque Atual | Posição completa com valor de custo e status de cada produto |
| Estoque Crítico | Lista todos os produtos abaixo do mínimo ou zerados |
| Valor em Estoque | Resumo financeiro: valor de custo, venda e margem potencial |
| Movimentações por Período | Filtro por data com totais de entradas e saídas |

### 🔔 Alertas
- Painel separando produtos **Críticos** (zerados) dos **Baixos** (abaixo do mínimo)
- Contador de alertas visível na barra de navegação em tempo real
- Botão de reposição rápida direto do painel

### 👥 Usuários *(Admin/Gerente)*
- Listagem com último login de cada usuário
- Edição de nome, perfil e status (ativo/inativo)
- Redefinição de senha

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Backend | Python 3.9+ · Flask 3.x |
| Banco de dados | SQLite 3 (módulo `sqlite3` nativo do Python) |
| Frontend | HTML5 · CSS3 · JavaScript ES6 (Vanilla SPA) |
| Gráficos | Chart.js 4.4 (via CDN) |
| Ícones | SVG inline — estilo Lucide (sem dependência externa) |
| Fontes | Google Fonts — Syne + DM Sans |
| Autenticação | Flask Sessions + hash SHA-256 |

> **Zero dependências de frontend** — sem React, Vue, Angular ou qualquer framework JS.

---

## 📁 Estrutura do Projeto

```
stockpro/
├── app.py                  # Aplicação Flask — rotas, lógica e API REST
├── seed.py                 # Popula o banco com dados de demonstração
├── requirements.txt        # Dependências Python (apenas Flask)
├── README.md
│
├── templates/
│   ├── login.html          # Tela de login e cadastro de usuário
│   └── dashboard.html      # Shell da SPA (Single Page Application)
│
└── static/
    ├── css/
    │   └── main.css        # Estilos globais com variáveis CSS (tema escuro)
    └── js/
        ├── icons.js        # 35 ícones SVG inline (sem CDN externo)
        └── app.js          # Toda a lógica do frontend (~1.000 linhas)
```

---

## ✅ Pré-requisitos

- **Python 3.9** ou superior
- **pip**
- Nenhuma outra dependência de sistema

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/stockpro.git
cd stockpro
```

### 2. (Recomendado) Crie um ambiente virtual

```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Instale as dependências

```bash
pip install -r requirements.txt
```

### 4. (Opcional) Popule com dados de demonstração

```bash
python seed.py
```

Cria automaticamente:
- 3 usuários (admin, gerente, operador)
- 6 categorias de produtos
- 3 fornecedores
- 15 produtos com estoques variados
- 30+ movimentações de exemplo

### 5. Inicie o servidor

```bash
python app.py
```

Acesse **http://localhost:5000** no navegador.

---

## 📖 Como Usar

### Primeiro acesso (sem seed)

1. Acesse `http://localhost:5000`
2. Clique em **Cadastrar** e crie sua conta
3. O **primeiro usuário** cadastrado vira **Administrador** automaticamente
4. Faça login e comece a usar

### Com dados de demonstração

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Administrador | `admin@stockpro.com` | `admin123` |
| Gerente | `gerente@stockpro.com` | `gerente123` |
| Operador | `operador@stockpro.com` | `operador123` |

---

## 👤 Usuários e Permissões

| Funcionalidade | Operador | Gerente | Admin |
|----------------|:--------:|:-------:|:-----:|
| Ver dashboard e relatórios | ✅ | ✅ | ✅ |
| Cadastrar / editar produtos | ✅ | ✅ | ✅ |
| Registrar entradas e saídas | ✅ | ✅ | ✅ |
| Gerenciar fornecedores | ✅ | ✅ | ✅ |
| Excluir produtos | ❌ | ✅ | ✅ |
| Excluir fornecedores | ❌ | ✅ | ✅ |
| Gerenciar usuários | ❌ | ✅ | ✅ |

---

## 🔌 API Endpoints

Todos os endpoints (exceto `/api/login`, `/api/logout` e `/api/cadastro`) exigem sessão autenticada.

### Autenticação
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/login` | Autenticar usuário |
| `POST` | `/api/logout` | Encerrar sessão |
| `POST` | `/api/cadastro` | Criar novo usuário |
| `GET` | `/api/sessao` | Verificar sessão ativa |

### Produtos
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/produtos` | Listar produtos (`?q=busca` · `?categoria=id`) |
| `POST` | `/api/produtos` | Criar produto |
| `PUT` | `/api/produtos/<id>` | Editar produto |
| `DELETE` | `/api/produtos/<id>` | Desativar produto |

### Fornecedores
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/fornecedores` | Listar fornecedores |
| `POST` | `/api/fornecedores` | Criar fornecedor |
| `PUT` | `/api/fornecedores/<id>` | Editar fornecedor |
| `DELETE` | `/api/fornecedores/<id>` | Desativar fornecedor |

### Movimentações
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/movimentacoes` | Listar movimentações (`?tipo=` · `?produto_id=`) |
| `POST` | `/api/movimentacoes` | Registrar entrada, saída ou ajuste |

### Relatórios & Dashboard
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/dashboard` | Todos os dados do dashboard |
| `GET` | `/api/relatorios/estoque` | Posição atual do estoque |
| `GET` | `/api/relatorios/movimentacoes` | Movimentações por período (`?data_ini=` · `?data_fim=`) |
| `GET` | `/api/categorias` | Listar categorias |
| `POST` | `/api/categorias` | Criar categoria |
| `GET` | `/api/usuarios` | Listar usuários *(admin/gerente)* |
| `PUT` | `/api/usuarios/<id>` | Editar usuário *(admin/gerente)* |

---

## 🗄️ Banco de Dados

O arquivo `estoque.db` é criado automaticamente na primeira execução. O esquema completo:

```sql
usuarios        → id, nome, email, senha_hash, perfil, ativo, criado_em, ultimo_login
categorias      → id, nome, descricao
fornecedores    → id, nome, cnpj, email, telefone, endereco, cidade, estado, ativo
produtos        → id, codigo*, nome, unidade, preco_custo, preco_venda,
                  estoque_atual, estoque_minimo, estoque_maximo,
                  localizacao, ativo, categoria_id → categorias, fornecedor_id → fornecedores
movimentacoes   → id, tipo (ENTRADA|SAIDA|AJUSTE), quantidade, preco_unitario,
                  motivo, nota_fiscal, data, produto_id → produtos, usuario_id → usuarios
```

> `*` campo com restrição UNIQUE

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Faça um **fork** do projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m "feat: descrição da mudança"`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um **Pull Request**

### Ideias para contribuição
- [ ] Exportação para PDF e Excel
- [ ] Ajuste de inventário em lote
- [ ] Notificações por e-mail para estoque crítico
- [ ] Autenticação JWT para uso como API externa
- [ ] Suporte a múltiplos depósitos/almoxarifados
- [ ] Tema claro alternável
- [ ] Histórico de alterações de preço por produto
- [ ] Gráfico de composição do estoque por categoria

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais informações.

---

<div align="center">
  <strong>StockPro v2.0</strong> · Python + Flask + SQLite · 2024<br>
  Se este projeto te ajudou, deixa uma ⭐
</div>
