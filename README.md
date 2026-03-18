# Agenda de Beleza - Studio Lucia Soares

Aplicacao web para agendamento de servicos de beleza, criada para portfolio e fase de testes com clientes reais.

## Demo

- Producao: https://agenda-de-beleza-studio-lucia-soare.vercel.app/
- Repositorio: https://github.com/sandroteixeirasilva-star/agenda-de-beleza-Studio-Lucia-Soares-

## Visao Geral

O projeto simula uma agenda virtual para um estudio de beleza, permitindo que clientes selecionem servicos, preencham seus dados e iniciem o envio do agendamento para o WhatsApp do salao.

Tambem existe um modo administrativo com protecao por PIN para gerenciar servicos, acompanhar os agendamentos salvos localmente e exportar os dados.

## Funcionalidades

- Selecionar multiplos servicos com calculo automatico de valor total e tempo estimado
- Preencher nome, telefone, data, horario e observacoes do agendamento
- Abrir o WhatsApp com a mensagem do agendamento pronta para envio ao salao
- Alternar entre modo cliente e modo admin
- Proteger o modo admin com PIN
- Criar, editar e remover servicos
- Filtrar agendamentos por data
- Exportar agendamentos para PDF
- Persistir dados localmente com localStorage

## Tecnologias

- React 19
- Vite 8
- JavaScript
- CSS
- localStorage
- Vercel

## Como Executar Localmente

```bash
npm install
npm run dev
```

Aplicacao local disponivel em um endereco parecido com:

```text
http://localhost:5173
```

## Build de Producao

```bash
npm run build
```

## Estrutura do Projeto

```text
src/
	App.jsx
	App.css
	index.css
	main.jsx
public/
```

## Fluxo Atual do Projeto

1. A cliente acessa o link do sistema.
2. Escolhe os servicos desejados.
3. Preenche os dados do agendamento.
4. O sistema monta a mensagem para o WhatsApp do salao.
5. A cliente confirma o envio diretamente no WhatsApp.

## Observacoes

- Esta versao foi pensada para testes e portfolio.
- Os dados ficam salvos no navegador, pois ainda nao ha backend ou banco de dados centralizado.
- Para uma versao de producao completa, o proximo passo seria adicionar autenticacao, API e persistencia em banco.

## Autor

- Sandro Teixeira Silva
