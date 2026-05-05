import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iluuitlqqorabiapbqnt.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsdXVpdGxxcW9yYWJpYXBicW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTg3ODcsImV4cCI6MjA5MzQzNDc4N30.TWfPoaaegja6I8walkHQqctx21TlYF4_eWZqdCdENn4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types alinhados com as tabelas do Supabase ────────────────────────────

export interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  tempo_minutos: number;
  valor: string;
  foto_url: string | null;
  ativo: boolean;
}

export interface Configuracoes {
  horario_inicio: string;   // "08:00:00"
  horario_fim: string;      // "18:00:00"
  intervalo_minutos: number;
  dias_semana: number[];    // 1=dom, 2=seg … 7=sáb
  nome_studio: string;
}

export interface Agendamento {
  id?: string;
  nome_cliente: string;
  telefone: string;
  servico_id: string;
  servico_nome: string;
  servico_tempo_minutos: number;
  data: string;           // "YYYY-MM-DD"
  horario_inicio: string; // "HH:MM"
  horario_fim: string;    // "HH:MM"
  observacoes?: string;
  status?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Soma minutos a um horário "HH:MM" e devolve "HH:MM" */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Gera lista de horários disponíveis para uma data, considerando agendamentos existentes */
export function gerarSlots(
  config: Configuracoes,
  agendamentosDoDia: Agendamento[],
  duracaoMinutos: number
): { time: string; status: "available" | "warning" | "occupied" }[] {
  const slots: { time: string; status: "available" | "warning" | "occupied" }[] = [];
  const inicio = config.horario_inicio.slice(0, 5); // "08:00"
  const fim = config.horario_fim.slice(0, 5);       // "18:00"

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  let current = toMinutes(inicio);
  const endMin = toMinutes(fim);

  while (current + duracaoMinutos <= endMin) {
    const timeStr = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
    const slotFim = current + duracaoMinutos;

    // Verifica conflito com agendamentos existentes
    const conflito = agendamentosDoDia.some((ag) => {
      const agIni = toMinutes(ag.horario_inicio.slice(0, 5));
      const agFim = toMinutes(ag.horario_fim.slice(0, 5));
      return current < agFim && slotFim > agIni;
    });

    // Verifica aviso: serviço termina dentro de 15 min de outro agendamento
    const aviso = !conflito && agendamentosDoDia.some((ag) => {
      const agIni = toMinutes(ag.horario_inicio.slice(0, 5));
      return Math.abs(slotFim - agIni) < 15 || Math.abs(agIni - slotFim) < 15;
    });

    if (!conflito) {
      slots.push({ time: timeStr, status: aviso ? "warning" : "available" });
    }

    current += config.intervalo_minutos;
  }

  return slots;
}
