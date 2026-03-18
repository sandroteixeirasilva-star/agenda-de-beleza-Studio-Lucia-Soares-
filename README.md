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
- Sincronizacao online de agendamentos entre dispositivos (opcional com Supabase)

## Tecnologias

- React 19
- Vite 8
- JavaScript
- CSS
- localStorage
- Supabase (opcional)
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

## Ativar Sincronizacao Online (Supabase)

1. Crie um projeto no Supabase.
2. No projeto, abra SQL Editor e rode este script:

```sql
create table if not exists public.appointments (
	id uuid primary key,
	client_name text not null,
	phone text not null,
	date date not null,
	time text not null,
	notes text,
	services jsonb not null default '[]'::jsonb,
	total_price numeric(10,2) not null default 0,
	total_duration integer not null default 0,
	created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

create policy "Allow anon read"
on public.appointments
for select
to anon
using (true);

create policy "Allow anon insert"
on public.appointments
for insert
to anon
with check (true);

create policy "Allow anon delete"
on public.appointments
for delete
to anon
using (true);
```

3. Copie as credenciais do projeto em Project Settings > API.
4. Crie um arquivo .env local baseado em .env.example.
5. Preencha:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

6. Reinicie o projeto com npm run dev.

Quando configurado, os agendamentos passam a aparecer em todos os dispositivos.

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
- Sem Supabase configurado, os dados ficam salvos apenas no navegador do dispositivo.
- Com Supabase configurado, os agendamentos ficam sincronizados online.
- Para uma versao de producao completa, o proximo passo seria adicionar autenticacao com perfis e regras de acesso mais restritas.

## Autor

- Sandro Teixeira Silva
