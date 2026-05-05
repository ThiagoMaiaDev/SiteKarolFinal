import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import heroBg from "@/assets/hero-bg.jpg";
import {
  supabase,
  addMinutes,
  gerarSlots,
  type Servico,
  type Configuracoes,
  type Agendamento,
} from "@/lib/supabase";

// ─── Imagens locais por serviço ────────────────────────────────────────────
import serviceGel from "@/assets/service-gel.jpg";
import serviceManicure from "@/assets/service-manicure.jpg";
import servicePedicure from "@/assets/service-pedicure.jpg";
import serviceNailart from "@/assets/service-nailart.jpg";

const FALLBACK_IMAGES: Record<string, string> = {
  "Alongamento em gel": serviceGel,
  "Manutenção": serviceManicure,
  "Blindagem": servicePedicure,
  "Esmaltação simples": serviceNailart,
};

function getImage(servico: Servico): string {
  if (servico.foto_url) return servico.foto_url;
  return (
    Object.entries(FALLBACK_IMAGES).find(([key]) =>
      servico.nome.toLowerCase().includes(key.toLowerCase().split(" ")[0])
    )?.[1] ?? serviceNailart
  );
}

function formatPreco(valor: string | number): string {
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function formatDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

// ─── Componente ServiceCard ────────────────────────────────────────────────
function ServiceCard({
  servico,
  selected,
  onSelect,
}: {
  servico: Servico;
  selected: boolean;
  onSelect: (s: Servico) => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(servico)}
      className={`group relative overflow-hidden rounded-2xl border-2 bg-card text-left transition-all duration-300 shadow-elegant cursor-pointer ${
        selected ? "gold-border shadow-gold" : "border-transparent hover:border-border"
      }`}
    >
      <div className="aspect-square overflow-hidden">
        <img
          src={getImage(servico)}
          alt={servico.nome}
          loading="lazy"
          width={320}
          height={320}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-semibold text-foreground leading-tight">
          {servico.nome}
        </h3>
        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
          <span>⏱ {formatDuracao(servico.tempo_minutos)}</span>
          <span className="font-semibold text-foreground">{formatPreco(servico.valor)}</span>
        </div>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs"
        >
          ✓
        </motion.div>
      )}
    </motion.button>
  );
}

// ─── Componente TimeSlotGrid ───────────────────────────────────────────────
function TimeSlotGrid({
  slots,
  selectedTime,
  onSelect,
  loading,
}: {
  slots: { time: string; status: "available" | "warning" }[];
  selectedTime: string | null;
  onSelect: (time: string, status: "available" | "warning") => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum horário disponível para esta data. Tente outro dia.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {slots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        return (
          <motion.button
            key={slot.time}
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(slot.time, slot.status)}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all duration-200 cursor-pointer ${
              isSelected
                ? "gold-border shadow-gold bg-primary/10"
                : slot.status === "available"
                  ? "border-available/30 bg-available/10 text-available-foreground hover:border-available/60"
                  : "border-warning-slot/30 bg-warning-slot/10 text-warning-slot-foreground hover:border-warning-slot/60"
            }`}
          >
            <span className="text-base font-semibold">{slot.time}</span>
            <span className="mt-0.5 text-[10px] opacity-70">
              {slot.status === "available" ? "Disponível" : "Intervalo curto"}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── BookingPage principal ─────────────────────────────────────────────────
export function BookingPage() {
  const [step, setStep] = useState<"service" | "details">("service");

  // Dados do Supabase
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [config, setConfig] = useState<Configuracoes | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [slots, setSlots] = useState<{ time: string; status: "available" | "warning" }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Seleções do usuário
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  // Modais
  const [warningOpen, setWarningOpen] = useState(false);
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savedBooking, setSavedBooking] = useState<Agendamento | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Carrega serviços e configurações do Supabase
  useEffect(() => {
    async function load() {
      const [{ data: sv }, { data: cfg }] = await Promise.all([
        supabase.from("servicos").select("*").eq("ativo", true).order("tempo_minutos"),
        supabase.from("configuracoes").select("*").single(),
      ]);
      if (sv) setServicos(sv);
      if (cfg) setConfig(cfg);
      setLoadingData(false);
    }
    load();
  }, []);

  // Carrega slots quando data ou serviço mudam
  useEffect(() => {
    if (!selectedDate || !selectedServico || !config) return;

    setLoadingSlots(true);
    setSelectedTime(null);

    supabase
      .from("agendamentos")
      .select("horario_inicio, horario_fim")
      .eq("data", selectedDate)
      .neq("status", "cancelado")
      .then(({ data }) => {
        const agendamentos = (data ?? []) as Agendamento[];
        const gerados = gerarSlots(config, agendamentos, selectedServico.tempo_minutos);
        setSlots(gerados);
        setLoadingSlots(false);
      });
  }, [selectedDate, selectedServico, config]);

  const handleServiceSelect = (servico: Servico) => {
    setSelectedServico(servico);
    setStep("details");
  };

  const handleTimeSelect = (time: string, status: "available" | "warning") => {
    if (status === "warning") {
      setPendingTime(time);
      setWarningOpen(true);
    } else {
      setSelectedTime(time);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServico || !selectedDate || !selectedTime) return;

    setIsLoading(true);

    const horarioFim = addMinutes(selectedTime, selectedServico.tempo_minutos);

    const agendamento: Agendamento = {
      nome_cliente: name,
      telefone: phone,
      servico_id: selectedServico.id,
      servico_nome: selectedServico.nome,
      servico_tempo_minutos: selectedServico.tempo_minutos,
      data: selectedDate,
      horario_inicio: selectedTime,
      horario_fim: horarioFim,
      observacoes: notes || undefined,
      status: "agendado",
    };

    const { data, error } = await supabase
      .from("agendamentos")
      .insert([agendamento])
      .select()
      .single();

    if (error) {
      console.error("Erro ao salvar:", error);
    }

    setSavedBooking(data ?? agendamento);
    setIsLoading(false);
    setConfirmOpen(true);
  };

  const resetBooking = () => {
    setStep("service");
    setSelectedServico(null);
    setSelectedDate("");
    setSelectedTime(null);
    setName("");
    setPhone("");
    setNotes("");
    setConfirmOpen(false);
    setSavedBooking(null);
    setSlots([]);
  };

  // Data mínima = hoje
  const today = new Date().toISOString().split("T")[0];

  // Filtra dias da semana bloqueados
  const isDateDisabled = (dateStr: string) => {
    if (!config) return false;
    const day = new Date(dateStr + "T00:00:00").getDay() + 1; // 1=dom
    return !config.dias_semana.includes(day);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroBg}
            alt="Karol Martins Studio"
            className="h-full w-full object-cover"
            width={1920}
            height={800}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:pb-24 sm:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Karol Martins
              <span className="block text-primary">Studio</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
              Agende seu horário com carinho e exclusividade. Escolha o
              procedimento, selecione o melhor horário e confirme seu atendimento.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Main */}
      <main id="agendar" className="mx-auto -mt-8 max-w-4xl px-4 pb-20">
        <AnimatePresence mode="wait">
          {/* STEP 1 — Escolher serviço */}
          {step === "service" && (
            <motion.section
              key="service"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="mb-6 text-center font-display text-2xl font-semibold text-foreground">
                Escolha seu procedimento
              </h2>

              {loadingData ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl bg-muted animate-pulse h-56" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {servicos.map((s) => (
                    <ServiceCard
                      key={s.id}
                      servico={s}
                      selected={selectedServico?.id === s.id}
                      onSelect={handleServiceSelect}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {/* STEP 2 — Detalhes */}
          {step === "details" && (
            <motion.section
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <button
                type="button"
                onClick={() => setStep("service")}
                className="mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                ← Voltar aos procedimentos
              </button>

              <div className="rounded-2xl border bg-card p-6 shadow-elegant sm:p-8">
                {/* Serviço selecionado */}
                {selectedServico && (
                  <div className="mb-6 flex items-center gap-4 rounded-xl bg-muted/50 p-4">
                    <img
                      src={getImage(selectedServico)}
                      alt={selectedServico.nome}
                      className="h-16 w-16 rounded-xl object-cover"
                      loading="lazy"
                      width={64}
                      height={64}
                    />
                    <div>
                      <h3 className="font-display text-lg font-semibold">{selectedServico.nome}</h3>
                      <p className="text-sm text-muted-foreground">
                        ⏱ {formatDuracao(selectedServico.tempo_minutos)} ·{" "}
                        {formatPreco(selectedServico.valor)}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Nome e telefone */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        Nome completo
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Digite seu nome"
                        className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">
                        WhatsApp
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      min={today}
                      value={selectedDate}
                      onChange={(e) => {
                        if (!isDateDisabled(e.target.value)) {
                          setSelectedDate(e.target.value);
                        }
                      }}
                      className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
                    />
                    {config && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Atendemos de segunda a sábado, das {config.horario_inicio.slice(0, 5)} às{" "}
                        {config.horario_fim.slice(0, 5)}
                      </p>
                    )}
                  </div>

                  {/* Horários */}
                  {selectedDate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.3 }}
                    >
                      <label className="mb-3 block text-sm font-medium text-foreground">
                        Horário disponível
                      </label>
                      <TimeSlotGrid
                        slots={slots}
                        selectedTime={selectedTime}
                        onSelect={handleTimeSelect}
                        loading={loadingSlots}
                      />
                    </motion.div>
                  )}

                  {/* Observações */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Observações <span className="text-muted-foreground">(opcional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Alguma preferência ou observação?"
                      rows={3}
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all resize-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    className="w-full"
                    disabled={!name || !phone || !selectedDate || !selectedTime || isLoading}
                  >
                    {isLoading ? "Confirmando..." : "Confirmar Agendamento"}
                  </Button>
                </form>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Modal aviso de intervalo curto */}
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Atenção ao intervalo</DialogTitle>
            <DialogDescription>
              O horário selecionado tem um intervalo curto com outro atendimento. Deseja prosseguir
              mesmo assim?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setWarningOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                setSelectedTime(pendingTime);
                setWarningOpen(false);
                setPendingTime(null);
              }}
            >
              Prosseguir mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-available/20 text-3xl">
            ✓
          </div>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Agendamento confirmado!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="mt-4 space-y-2 text-sm text-left">
                <p><strong>Cliente:</strong> {savedBooking?.nome_cliente}</p>
                <p><strong>WhatsApp:</strong> {savedBooking?.telefone}</p>
                <p><strong>Procedimento:</strong> {savedBooking?.servico_nome}</p>
                <p>
                  <strong>Data:</strong>{" "}
                  {savedBooking?.data
                    ? new Date(savedBooking.data + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </p>
                <p>
                  <strong>Horário:</strong> {savedBooking?.horario_inicio} às{" "}
                  {savedBooking?.horario_fim}
                </p>
                {savedBooking?.observacoes && (
                  <p><strong>Observações:</strong> {savedBooking.observacoes}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-center">
            <Button variant="gold" size="lg" onClick={resetBooking}>
              Novo agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        <p className="font-display">Karol Martins Studio</p>
        <p className="mt-1 text-xs">Atendimento premium em nail art</p>
        <a className="mt-3 inline-block text-xs hover:text-foreground" href="/admin">
          Area administrativa
        </a>
      </footer>
    </div>
  );
}
