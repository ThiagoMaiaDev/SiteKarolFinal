import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ImageUp,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  supabase,
  type Agendamento,
  type AgendamentoStatus,
  type Configuracoes,
  type Servico,
  type Usuario,
  type UsuarioPerfil,
} from "@/lib/supabase";

const STATUS_LABELS: Record<AgendamentoStatus, string> = {
  agendado: "Agendado",
  concluido: "Concluido",
  cancelado: "Cancelado",
  nao_compareceu: "Nao compareceu",
};

const STATUS_STYLES: Record<AgendamentoStatus, string> = {
  agendado: "bg-primary/15 text-primary border-primary/25",
  concluido: "bg-available/15 text-available border-available/25",
  cancelado: "bg-destructive/15 text-destructive border-destructive/25",
  nao_compareceu: "bg-warning-slot/20 text-warning-slot-foreground border-warning-slot/30",
};

const emptyServico = {
  nome: "",
  descricao: "",
  tempo_minutos: 60,
  valor: "0",
  foto_url: "",
  ativo: true,
};

const emptyUsuario: Usuario = {
  nome: "",
  email: "",
  perfil: "recepcionista",
  ativo: true,
};

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function canManage(perfil?: UsuarioPerfil, ativo = true) {
  return ativo && perfil === "administrador";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputClass() {
  return "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60";
}

function textareaClass() {
  return "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60";
}

export function AdminPage() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [usuarioAtual, setUsuarioAtual] = useState<Usuario | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [config, setConfig] = useState<Configuracoes | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [servicoForm, setServicoForm] = useState<Omit<Servico, "id">>(emptyServico);
  const [servicoEditId, setServicoEditId] = useState<string | null>(null);
  const [servicoFile, setServicoFile] = useState<File | null>(null);

  const [usuarioForm, setUsuarioForm] = useState<Usuario>(emptyUsuario);
  const [usuarioEditId, setUsuarioEditId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsLogged(Boolean(data.session));
      setSessionChecked(true);
      if (data.session?.user.email) loadUserProfile(data.session.user.email);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLogged(Boolean(session));
      if (session?.user.email) loadUserProfile(session.user.email);
      if (!session) setUsuarioAtual(null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLogged) loadAll();
  }, [isLogged, selectedDate]);

  async function loadUserProfile(email: string) {
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (data) {
      setUsuarioAtual(data as Usuario);
      return;
    }

    const { count } = await supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true });

    if (count === 0) {
      const primeiroAdmin = {
        nome: signupName || email.split("@")[0],
        email,
        perfil: "administrador" as UsuarioPerfil,
        ativo: true,
      };

      const { data: inserted } = await supabase
        .from("usuarios")
        .insert([primeiroAdmin])
        .select()
        .single();

      setUsuarioAtual((inserted as Usuario | null) ?? primeiroAdmin);
      setMessage("Primeiro administrador configurado automaticamente.");
      return;
    }

    setUsuarioAtual({
      nome: email.split("@")[0],
      email,
      perfil: "recepcionista",
      ativo: false,
    });
    setMessage("Este email ainda nao esta cadastrado em Usuarios.");
  }

  async function loadAll() {
    const [ag, sv, us, cfg] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("*")
        .gte("data", selectedDate)
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true }),
      supabase.from("servicos").select("*").order("nome"),
      supabase.from("usuarios").select("*").order("nome"),
      supabase.from("configuracoes").select("*").limit(1).maybeSingle(),
    ]);

    setAgendamentos((ag.data ?? []) as Agendamento[]);
    setServicos((sv.data ?? []) as Servico[]);
    setUsuarios((us.data ?? []) as Usuario[]);
    if (cfg.data) setConfig(cfg.data as Configuracoes);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoadingLogin(true);
    setLoginError("");

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email: loginEmail,
        password: loginPassword,
        options: {
          data: { nome: signupName },
        },
      });

      if (error) {
        setLoginError("Nao foi possivel criar o primeiro administrador.");
      } else if (!data.session) {
        setLoginError("Conta criada. Confirme o email no Supabase/Auth e depois faca login.");
      }

      setLoadingLogin(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) setLoginError("Email ou senha invalidos.");
    setLoadingLogin(false);
  }

  async function updateStatus(id: string | undefined, status: AgendamentoStatus) {
    if (!id || !usuarioAtual?.ativo) return;
    await supabase.from("agendamentos").update({ status }).eq("id", id);
    await loadAll();
  }

  async function deleteAgendamento(id: string | undefined) {
    if (!id || !usuarioAtual?.ativo) return;
    if (!window.confirm("Tem certeza que deseja excluir este agendamento permanentemente?")) return;
    await supabase.from("agendamentos").delete().eq("id", id);
    await loadAll();
  }

  async function uploadServicoImage() {
    if (!servicoFile) return servicoForm.foto_url || null;

    const ext = servicoFile.name.split(".").pop() || "jpg";
    // Caminho direto na raiz do bucket 'servicos' (sem prefixo duplicado)
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("servicos").upload(path, servicoFile, {
      upsert: true,
    });

    if (error) {
      setMessage(`Erro ao enviar imagem: ${error.message}`);
      return servicoForm.foto_url || null;
    }

    const { data } = supabase.storage.from("servicos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function saveServico(event: FormEvent) {
    event.preventDefault();
    if (!canManage(usuarioAtual?.perfil, usuarioAtual?.ativo)) return;
    setSaving(true);

    const foto_url = await uploadServicoImage();
    const payload = {
      ...servicoForm,
      valor: String(servicoForm.valor),
      tempo_minutos: Number(servicoForm.tempo_minutos),
      foto_url,
    };

    if (servicoEditId) {
      await supabase.from("servicos").update(payload).eq("id", servicoEditId);
    } else {
      await supabase.from("servicos").insert([payload]);
    }

    setServicoForm(emptyServico);
    setServicoEditId(null);
    setServicoFile(null);
    setMessage("Servico salvo.");
    setSaving(false);
    await loadAll();
  }

  async function toggleServico(servico: Servico) {
    if (!canManage(usuarioAtual?.perfil, usuarioAtual?.ativo)) return;
    await supabase.from("servicos").update({ ativo: !servico.ativo }).eq("id", servico.id);
    await loadAll();
  }

  async function deleteServico(servico: Servico) {
    if (!canManage(usuarioAtual?.perfil, usuarioAtual?.ativo)) return;
    if (!window.confirm(`Remover o servico "${servico.nome}"?`)) return;
    await supabase.from("servicos").delete().eq("id", servico.id);
    setMessage("Servico removido.");
    await loadAll();
  }

  async function saveUsuario(event: FormEvent) {
    event.preventDefault();
    if (!canManage(usuarioAtual?.perfil, usuarioAtual?.ativo)) return;
    setSaving(true);

    if (usuarioEditId) {
      await supabase.from("usuarios").update(usuarioForm).eq("id", usuarioEditId);
    } else {
      await supabase.from("usuarios").insert([usuarioForm]);
    }

    setUsuarioForm(emptyUsuario);
    setUsuarioEditId(null);
    setMessage("Usuario salvo. O acesso com senha deve existir no Supabase Auth.");
    setSaving(false);
    await loadAll();
  }

  async function deleteUsuario(usuario: Usuario) {
    if (!canManage(usuarioAtual?.perfil, usuarioAtual?.ativo) || !usuario.id) return;
    if (!window.confirm(`Remover o usuario "${usuario.nome}" da tabela de permissoes?`)) return;
    await supabase.from("usuarios").delete().eq("id", usuario.id);
    setMessage("Usuario removido da tabela de permissoes.");
    await loadAll();
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    if (!config || !canManage(usuarioAtual?.perfil, usuarioAtual?.ativo)) return;
    setSaving(true);

    const payload = {
      ...config,
      intervalo_minutos: Number(config.intervalo_minutos),
      dias_semana: config.dias_semana.map(Number),
    };

    if (config.id) {
      await supabase.from("configuracoes").update(payload).eq("id", config.id);
    } else {
      await supabase.from("configuracoes").insert([payload]);
    }

    setMessage("Configuracoes salvas.");
    setSaving(false);
    await loadAll();
  }

  const agendaDia = useMemo(
    () => agendamentos.filter((item) => item.data === selectedDate),
    [agendamentos, selectedDate],
  );

  const proximos = useMemo(
    () => agendamentos.filter((item) => item.status !== "cancelado").slice(0, 5),
    [agendamentos],
  );

  if (!sessionChecked) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  if (!isLogged) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-elegant"
        >
          <div className="mb-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 font-display text-2xl font-semibold">Painel administrativo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup
                ? "Crie o primeiro administrador. Depois ele podera cadastrar os demais usuarios."
                : "Login necessario para agenda, servicos, usuarios, configuracoes e dashboard."}
            </p>
          </div>

          <div className="space-y-4">
            {isSignup && (
              <Field label="Nome">
                <input
                  className={inputClass()}
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  required
                />
              </Field>
            )}
            <Field label="Email">
              <input
                className={inputClass()}
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Senha">
              <input
                className={inputClass()}
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </Field>
          </div>

          {loginError && <p className="mt-3 text-sm text-destructive">{loginError}</p>}

          <Button className="mt-6 w-full" variant="gold" type="submit" disabled={loadingLogin}>
            {loadingLogin ? "Aguarde..." : isSignup ? "Criar primeiro administrador" : "Entrar"}
          </Button>
          <button
            type="button"
            className="mt-4 block w-full text-center text-sm text-primary hover:underline"
            onClick={() => {
              setIsSignup(!isSignup);
              setLoginError("");
            }}
          >
            {isSignup ? "Ja tenho acesso" : "Criar primeiro administrador"}
          </button>
          <a className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground" href="/">
            Voltar para agendamento publico
          </a>
        </form>
      </main>
    );
  }

  const admin = canManage(usuarioAtual?.perfil, usuarioAtual?.ativo);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Karol Martins Studio</p>
            <h1 className="font-display text-2xl font-semibold">Painel administrativo</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-8 px-3">
              {!usuarioAtual?.ativo
                ? "Sem permissao"
                : usuarioAtual?.perfil === "administrador"
                  ? "Administrador"
                  : "Recepcionista"}
            </Badge>
            <Button variant="outline" asChild>
              <a href="/">Agenda publica</a>
            </Button>
            <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
              <LogOut />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {message && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <Tabs defaultValue="dashboard" className="space-y-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <CalendarDays className="mr-2 h-4 w-4" />
              Agendados
            </TabsTrigger>
            <TabsTrigger value="servicos" disabled={!admin}>
              <Sparkles className="mr-2 h-4 w-4" />
              Servicos
            </TabsTrigger>
            <TabsTrigger value="usuarios" disabled={!admin}>
              <Users className="mr-2 h-4 w-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="configuracoes" disabled={!admin}>
              <Settings className="mr-2 h-4 w-4" />
              Configuracoes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-5">
            <section className="grid gap-4 md:grid-cols-4">
              <Metric title="Agenda do dia" value={agendaDia.length} icon={<CalendarDays />} />
              <Metric title="Proximos atendimentos" value={proximos.length} icon={<Clock />} />
              <Metric title="Total de servicos" value={servicos.length} icon={<Sparkles />} />
              <Metric title="Usuarios ativos" value={usuarios.filter((u) => u.ativo).length} icon={<Users />} />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <Panel title="Agenda do dia">
                <AgendaList agendamentos={agendaDia} onStatus={updateStatus} onDelete={deleteAgendamento} />
              </Panel>
              <Panel title="Acoes rapidas">
                <div className="grid gap-3">
                  <Button variant="outline" onClick={() => setSelectedDate(todayIso())}>
                    Ver hoje
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/#agendar">Abrir agenda publica</a>
                  </Button>
                  <Button variant="gold" disabled={!admin} onClick={() => setMessage("Use a aba Servicos para cadastrar ou editar procedimentos.")}>
                    Novo servico
                  </Button>
                </div>
              </Panel>
            </section>
          </TabsContent>

          <TabsContent value="agenda">
            <Panel
              title="Agendados"
              action={
                <input
                  className={inputClass() + " max-w-44"}
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              }
            >
              <AgendaList agendamentos={agendamentos} onStatus={updateStatus} onDelete={deleteAgendamento} />
            </Panel>
          </TabsContent>

          <TabsContent value="servicos">
            <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
              <Panel title={servicoEditId ? "Editar servico" : "Cadastrar servico"}>
                <form onSubmit={saveServico} className="space-y-4">
                  <Field label="Nome">
                    <input className={inputClass()} value={servicoForm.nome} onChange={(e) => setServicoForm({ ...servicoForm, nome: e.target.value })} required />
                  </Field>
                  <Field label="Descricao">
                    <textarea className={textareaClass()} value={servicoForm.descricao ?? ""} onChange={(e) => setServicoForm({ ...servicoForm, descricao: e.target.value })} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tempo (min)">
                      <input className={inputClass()} type="number" min="5" value={servicoForm.tempo_minutos} onChange={(e) => setServicoForm({ ...servicoForm, tempo_minutos: Number(e.target.value) })} required />
                    </Field>
                    <Field label="Valor">
                      <input className={inputClass()} type="number" min="0" step="0.01" value={servicoForm.valor} onChange={(e) => setServicoForm({ ...servicoForm, valor: e.target.value })} required />
                    </Field>
                  </div>
                  <Field label="URL da imagem (opcional)">
                    <input className={inputClass()} value={servicoForm.foto_url ?? ""} onChange={(e) => setServicoForm({ ...servicoForm, foto_url: e.target.value })} placeholder="https://..." />
                  </Field>
                  <Field label="Upload de imagem">
                    <input className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm" type="file" accept="image/*" onChange={(e) => setServicoFile(e.target.files?.[0] ?? null)} />
                    {servicoFile && (
                      <p className="mt-1 text-xs text-muted-foreground">Arquivo selecionado: {servicoFile.name}</p>
                    )}
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={servicoForm.ativo} onChange={(e) => setServicoForm({ ...servicoForm, ativo: e.target.checked })} />
                    Servico ativo
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" variant="gold" disabled={saving}>
                      <ImageUp />
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setServicoForm(emptyServico); setServicoEditId(null); setServicoFile(null); }}>
                      Limpar
                    </Button>
                  </div>
                </form>
              </Panel>

              <Panel title="Servicos cadastrados">
                <div className="grid gap-3 md:grid-cols-2">
                  {servicos.map((servico) => (
                    <div key={servico.id} className="rounded-lg border p-4">
                      <div className="flex gap-3">
                        {servico.foto_url && <img src={servico.foto_url} alt={servico.nome} className="h-16 w-16 rounded-lg object-cover" />}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold">{servico.nome}</h3>
                          <p className="text-sm text-muted-foreground">{servico.tempo_minutos} min - R$ {servico.valor}</p>
                          <Badge variant="outline" className="mt-2">{servico.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setServicoForm({ ...servico, foto_url: servico.foto_url ?? "", descricao: servico.descricao ?? "" }); setServicoEditId(servico.id); }}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleServico(servico)}>
                          {servico.ativo ? "Desativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteServico(servico)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          </TabsContent>

          <TabsContent value="usuarios">
            <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
              <Panel title={usuarioEditId ? "Editar usuario" : "Cadastrar usuario"}>
                <form onSubmit={saveUsuario} className="space-y-4">
                  <Field label="Nome">
                    <input className={inputClass()} value={usuarioForm.nome} onChange={(e) => setUsuarioForm({ ...usuarioForm, nome: e.target.value })} required />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass()} type="email" value={usuarioForm.email} onChange={(e) => setUsuarioForm({ ...usuarioForm, email: e.target.value })} required />
                  </Field>
                  <Field label="Permissao">
                    <select className={inputClass()} value={usuarioForm.perfil} onChange={(e) => setUsuarioForm({ ...usuarioForm, perfil: e.target.value as UsuarioPerfil })}>
                      <option value="administrador">Administrador</option>
                      <option value="recepcionista">Recepcionista</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={usuarioForm.ativo} onChange={(e) => setUsuarioForm({ ...usuarioForm, ativo: e.target.checked })} />
                    Usuario ativo
                  </label>
                  <Button type="submit" variant="gold" disabled={saving}>Salvar usuario</Button>
                </form>
              </Panel>

              <Panel title="Controle de usuarios">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2">Nome</th>
                        <th>Email</th>
                        <th>Permissao</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((usuario) => (
                        <tr key={usuario.id ?? usuario.email} className="border-b">
                          <td className="py-3">{usuario.nome}</td>
                          <td>{usuario.email}</td>
                          <td>{usuario.perfil === "administrador" ? "Administrador" : "Recepcionista"}</td>
                          <td>{usuario.ativo ? "Ativo" : "Inativo"}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => { setUsuarioForm(usuario); setUsuarioEditId(usuario.id ?? null); }}>
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteUsuario(usuario)} disabled={!usuario.id}>
                                Remover
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>
          </TabsContent>

          <TabsContent value="configuracoes">
            <Panel title="Configuracoes da agenda">
              {config ? (
                <form onSubmit={saveConfig} className="grid gap-4 md:grid-cols-2">
                  <Field label="Nome do studio">
                    <input className={inputClass()} value={config.nome_studio} onChange={(e) => setConfig({ ...config, nome_studio: e.target.value })} />
                  </Field>
                  <Field label="Intervalo entre horarios (min)">
                    <input className={inputClass()} type="number" min="5" value={config.intervalo_minutos} onChange={(e) => setConfig({ ...config, intervalo_minutos: Number(e.target.value) })} />
                  </Field>
                  <Field label="Horario inicial">
                    <input className={inputClass()} type="time" value={config.horario_inicio.slice(0, 5)} onChange={(e) => setConfig({ ...config, horario_inicio: e.target.value })} />
                  </Field>
                  <Field label="Horario final">
                    <input className={inputClass()} type="time" value={config.horario_fim.slice(0, 5)} onChange={(e) => setConfig({ ...config, horario_fim: e.target.value })} />
                  </Field>
                  <div className="md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Dias de atendimento
                    </span>
                    <div className="flex flex-wrap gap-3">
                      {[
                        ["1", "Dom"],
                        ["2", "Seg"],
                        ["3", "Ter"],
                        ["4", "Qua"],
                        ["5", "Qui"],
                        ["6", "Sex"],
                        ["7", "Sab"],
                      ].map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={config.dias_semana.includes(Number(value))}
                            onChange={(event) => {
                              const day = Number(value);
                              const dias = event.target.checked
                                ? [...config.dias_semana, day]
                                : config.dias_semana.filter((item) => item !== day);
                              setConfig({ ...config, dias_semana: dias.sort() });
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" variant="gold" disabled={saving}>Salvar configuracoes</Button>
                  </div>
                </form>
              ) : (
                <Button
                  variant="gold"
                  onClick={() =>
                    setConfig({
                      nome_studio: "Karol Martins Studio",
                      horario_inicio: "08:00",
                      horario_fim: "18:00",
                      intervalo_minutos: 30,
                      dias_semana: [2, 3, 4, 5, 6],
                    })
                  }
                >
                  Criar configuracao inicial
                </Button>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="text-primary [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function AgendaList({
  agendamentos,
  onStatus,
  onDelete,
}: {
  agendamentos: Agendamento[];
  onStatus: (id: string | undefined, status: AgendamentoStatus) => void;
  onDelete: (id: string | undefined) => void;
}) {
  if (agendamentos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>;
  }

  return (
    <div className="space-y-3">
      {agendamentos.map((agendamento) => {
        const status = (agendamento.status ?? "agendado") as AgendamentoStatus;
        return (
          <div key={agendamento.id ?? `${agendamento.data}-${agendamento.horario_inicio}`} className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{agendamento.nome_cliente}</h3>
                  <Badge variant="outline" className={STATUS_STYLES[status]}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(agendamento.data)} - {agendamento.horario_inicio} as {agendamento.horario_fim}
                </p>
                <p className="text-sm">{agendamento.servico_nome}</p>
                <p className="text-sm text-muted-foreground">{agendamento.telefone}</p>
                {agendamento.observacoes && (
                  <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm">{agendamento.observacoes}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button size="sm" variant="outline" onClick={() => onStatus(agendamento.id, "concluido")}>
                  <CheckCircle2 />
                  Concluir
                </Button>
                <Button size="sm" variant="outline" onClick={() => onStatus(agendamento.id, "nao_compareceu")}>
                  Nao compareceu
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onStatus(agendamento.id, "cancelado")}>
                  <XCircle />
                  Cancelar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(agendamento.id)}>
                  <Trash2 />
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
