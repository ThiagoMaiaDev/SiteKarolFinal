# Karol Martins Studio — Agendamento Online

## Rodar localmente

```bash
npm install
npm run dev
```

## Deploy no Vercel

1. Crie um novo projeto no Vercel e aponte para este repositório (ou faça upload via CLI)
2. Em **Project Settings → Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = `https://iluuitlqqorabiapbqnt.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(copie do Supabase → Project Settings → API → anon/public)*
3. Redeploy — pronto!

> O banco de dados já está configurado no Supabase com todas as tabelas, políticas e serviços.
