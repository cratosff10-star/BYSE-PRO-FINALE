// @ts-nocheck

import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  User,
  Plus,
  Search,
  Check,
  Edit2,
  Save,
  X,
  MessageCircle,
  Key,
  QrCode,
  Smartphone
} from "lucide-react";
import { FONT_BODY, SUCCESS } from "../data/constants";
import { inputStyle } from "../utils/helpers";
import { SectionTitle, Pill, SLabel } from "../components/common";

const WEEK_DAYS = [
  { value: "segunda", label: "Segunda-feira" },
  { value: "terça", label: "Terça-feira" },
  { value: "quarta", label: "Quarta-feira" },
  { value: "quinta", label: "Quinta-feira" },
  { value: "sexta", label: "Sexta-feira" },
  { value: "sábado", label: "Sábado" },
  { value: "domingo", label: "Domingo" }
];

const DEFAULT_MESSAGE =
  "Olá {nome}! 👋\n\n" +
  "Temos novidades especiais para você na BYSE PRO.\n\n" +
  "Passe para conferir nossas ofertas e aproveite seu cashback! 🎁 (Saldo: {saldo})";

const createSchedule = (number) => ({
  id: `wa-${Date.now()}-${number}`,
  label: `Mensagem ${number}`,
  enabled: false,
  days: [],
  time: "10:00",
  text: DEFAULT_MESSAGE,
  sendToAll: true,
  customerIds: []
});

function WhatsApp({
  waSchedule,
  setWaSchedule,
  card,
  border,
  subtext,
  accent,
  text,
  customers = []
}) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

  const [apiUrlInput, setApiUrlInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  
  // Estado interno para garantir que os clientes sejam carregados caso a prop venha vazia
  const [localCustomers, setLocalCustomers] = useState(customers);
  
  // Estados para gerenciar o QR Code, conexão e polling de status da Evolution API
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");

  // Sincroniza caso a prop mude
  useEffect(() => {
    if (customers && customers.length > 0) {
      setLocalCustomers(customers);
    }
  }, [customers]);

  // Carrega as configurações, credenciais, clientes e programações salvas no banco ao abrir a página
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("byse_token");
      const user = JSON.parse(localStorage.getItem("byse_user") || "{}");
      const headers = { 
        "Authorization": `Bearer ${token}`, 
        "x-user-id": user.id || localStorage.getItem("userId") || "user_1" 
      };

      try {
        // Busca clientes diretamente caso venham vazios via props
        const resClientes = await fetch(`${API_URL}/api/clientes`, { headers });
        if (resClientes.ok) {
          const clientesData = await resClientes.json();
          if (Array.isArray(clientesData) && clientesData.length > 0) {
            setLocalCustomers(clientesData);
          }
        }

        const resConfig = await fetch(`${API_URL}/api/user/whatsapp-config`, { headers });
        if (resConfig.ok) {
          const configData = await resConfig.json();
          setApiUrlInput(configData.apiUrl || "");
          setApiKeyInput(configData.apiKey || "");
          if (configData.apiUrl) {
            setConnectionStatus("Configurado");
          }
        }

        const response = await fetch(`${API_URL}/api/whatsapp`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setWaSchedule(data);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do WhatsApp:", error);
      }
    };

    fetchData();
  }, [setWaSchedule, API_URL]);

  // Polling automático para verificar o status da conexão após gerar o QR Code
  useEffect(() => {
    let interval;

    if (qrCodeData && connectionStatus !== "Conectado") {
      const token = localStorage.getItem("byse_token");
      const user = JSON.parse(localStorage.getItem("byse_user") || "{}");

      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/whatsapp/status/${user.id || 'user_1'}`, {
            headers: {
              "Authorization": `Bearer ${token}`,
              "x-user-id": user.id || "user_1"
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.connected) {
              setConnectionStatus("Conectado");
              setQrCodeData(null); 
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error("Erro ao verificar status da conexão:", err);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [qrCodeData, connectionStatus, API_URL]);

  // Função para solicitar a criação de instância e gerar o QR Code direto na tela
  const handleGerarQrCode = async () => {
    setLoadingQr(true);
    const token = localStorage.getItem("byse_token");
    const user = JSON.parse(localStorage.getItem("byse_user") || "{}");

    try {
      const res = await fetch(`${API_URL}/api/whatsapp/connect`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-user-id": user.id || localStorage.getItem("userId") || "user_1",
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (data.qrCode) {
        setQrCodeData(data.qrCode);
        if (data.apiUrl) setApiUrlInput(data.apiUrl);
        if (data.apiKey) setApiKeyInput(data.apiKey);
        setConnectionStatus("Aguardando Leitura do QR Code");
      } else {
        alert("Não foi possível gerar o QR Code. Verifique as configurações globais da Evolution API.");
      }
    } catch (err) {
      console.error("Erro ao gerar QR Code:", err);
      alert("Erro ao conectar com o servidor do WhatsApp.");
    } finally {
      setLoadingQr(false);
    }
  };

  const persistSchedules = async (newSchedules) => {
    setWaSchedule(newSchedules);
    const token = localStorage.getItem("byse_token");
    const user = JSON.parse(localStorage.getItem("byse_user") || "{}");

    try {
      await fetch(`${API_URL}/api/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-user-id": user.id || localStorage.getItem("userId") || "user_1"
        },
        body: JSON.stringify(newSchedules)
      });
    } catch (error) {
      console.error("Erro ao salvar programações no servidor:", error);
    }
  };

  const normalizedSchedule = useMemo(() => {
    const current = (Array.isArray(waSchedule) ? waSchedule : []).map(
      (item, index) => ({
        ...createSchedule(index + 1),
        ...item,
        days: Array.isArray(item?.days) ? item.days : item?.day ? [item.day] : []
      })
    );
    while (current.length < 3) {
      current.push(createSchedule(current.length + 1));
    }
    return current.slice(0, 3);
  }, [waSchedule]);

  useEffect(() => {
    if (!Array.isArray(waSchedule) || waSchedule.length !== 3) {
      setWaSchedule(normalizedSchedule);
    }
  }, [waSchedule, normalizedSchedule, setWaSchedule]);

  const [editingId, setEditingId] = useState(null);
  const [editDays, setEditDays] = useState([]);
  const [editTime, setEditTime] = useState("10:00");
  const [editText, setEditText] = useState("");
  const [editSendToAll, setEditSendToAll] = useState(true);
  const [editCustomerIds, setEditCustomerIds] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");

  const getUsedDays = (currentId) =>
    normalizedSchedule
      .filter((s) => s.id !== currentId)
      .flatMap((s) => (Array.isArray(s.days) ? s.days : []));

  const toggleDay = (day) => {
    setEditDays((current) => {
      const days = Array.isArray(current) ? current : [];
      if (days.includes(day)) return days.filter((item) => item !== day);
      return [...days, day];
    });
  };

  const startEdit = (schedule) => {
    setEditingId(schedule.id);
    setEditDays(Array.isArray(schedule.days) ? [...schedule.days] : []);
    setEditTime(schedule.time || "10:00");
    setEditText(schedule.text || DEFAULT_MESSAGE);
    setEditSendToAll(schedule.sendToAll !== false);
    setEditCustomerIds(Array.isArray(schedule.customerIds) ? [...schedule.customerIds] : []);
    setCustomerSearch("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDays([]);
    setEditTime("10:00");
    setEditText("");
    setEditSendToAll(true);
    setEditCustomerIds([]);
    setCustomerSearch("");
  };

  const saveEdit = (id) => {
    if (!editDays.length) {
      alert("Selecione pelo menos um dia da semana.");
      return;
    }
    if (!editText.trim()) {
      alert("Digite uma mensagem antes de salvar.");
      return;
    }
    if (!editSendToAll && editCustomerIds.length === 0) {
      alert("Selecione pelo menos um cliente para o envio.");
      return;
    }

    const updated = normalizedSchedule.map((schedule) =>
      schedule.id === id
        ? {
            ...schedule,
            days: [...editDays],
            time: editTime,
            text: editText,
            sendToAll: editSendToAll,
            customerIds: editSendToAll ? [] : [...editCustomerIds]
          }
        : schedule
    );

    persistSchedules(updated);
    cancelEdit();
  };

  const toggle = (id) => {
    const schedule = normalizedSchedule.find((item) => item.id === id);
    if (!schedule) return;

    if (!schedule.enabled && !schedule.days?.length) {
      startEdit(schedule);
      return;
    }

    const updated = normalizedSchedule.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    persistSchedules(updated);
  };

  const toggleCustomer = (customerId) => {
    setEditCustomerIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId]
    );
  };

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.toLowerCase().trim();
    if (!search) return localCustomers;
    return localCustomers.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
  }, [localCustomers, customerSearch]);

  const getDaysLabel = (days) => {
    if (!Array.isArray(days) || days.length === 0) return "Nenhum dia selecionado";
    return days.map((d) => WEEK_DAYS.find((item) => item.value === d)?.label || d).join(", ");
  };

  return (
    <div>
      <SectionTitle
        title="Integração com WhatsApp"
        sub="Conecte seu WhatsApp via QR Code e gerencie seus disparos automáticos"
        subtext={subtext}
      />

      {/* PAINEL DE CONEXÃO VIA QR CODE */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Smartphone size={18} color={accent} />
          Conexão do WhatsApp do Usuário
          <Pill color={connectionStatus === "Conectado" ? SUCCESS : subtext}>
            {connectionStatus}
          </Pill>
        </div>
        <p style={{ fontSize: 12.5, color: subtext, marginBottom: 14 }}>
          Clique no botão abaixo para gerar o seu QR Code de conexão instantânea. Assim que escanear com o seu celular, sua conta estará pronta para os disparos automáticos nos números dos clientes cadastrados.
        </p>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleGerarQrCode}
            disabled={loadingQr}
            style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}
          >
            <QrCode size={16} />
            {loadingQr ? "Gerando QR Code..." : "Gerar QR Code de Conexão"}
          </button>
        </div>

        {connectionStatus === "Conectado" && (
          <div style={{ marginTop: 15, padding: 10, background: `${SUCCESS}15`, border: `1px solid ${SUCCESS}`, borderRadius: 8, color: SUCCESS, fontWeight: 600, fontSize: 13 }}>
            WhatsApp conectado com sucesso! Suas mensagens serão enviadas automaticamente nos horários programados.
          </div>
        )}

        {qrCodeData && (
          <div style={{ marginTop: 18, textAlign: "center", background: `${card}dd`, padding: 15, borderRadius: 10, border: `1px solid ${border}`, display: "inline-block" }}>
            <img src={qrCodeData} alt="QR Code WhatsApp" style={{ width: 200, height: 200, borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: subtext, marginTop: 8 }}>
              Abra o WhatsApp no celular {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho
            </p>
          </div>
        )}
      </div>

      {/* LISTA DE AGENDAMENTOS DE MENSAGENS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {normalizedSchedule.map((schedule) => {
          const usedDays = getUsedDays(schedule.id);

          return (
            <div
              key={schedule.id}
              style={{
                background: card,
                border: `1px solid ${border}`,
                borderRadius: 12,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 14,
                  borderBottom: `1px solid ${border}`,
                  gap: 10
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <MessageCircle size={16} color={accent} />
                    {schedule.label}
                    <Pill color={schedule.enabled ? SUCCESS : subtext}>
                      {schedule.enabled ? "Ativo" : "Pausado"}
                    </Pill>
                  </div>
                </div>

                <label style={{ position: "relative", display: "inline-block", width: 38, height: 21, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => toggle(schedule.id)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{ position: "absolute", inset: 0, background: schedule.enabled ? accent : "#ccc", borderRadius: 20 }} />
                  <span style={{ position: "absolute", height: 15, width: 15, left: schedule.enabled ? 20 : 3, bottom: 3, background: "#fff", borderRadius: "50%" }} />
                </label>
              </div>

              <div style={{ padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <SLabel subtext={subtext}>DIAS</SLabel>
                    <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600 }}>{getDaysLabel(schedule.days)}</div>
                  </div>
                  <div>
                    <SLabel subtext={subtext}>HORÁRIO</SLabel>
                    <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600 }}>{schedule.time || "10:00"}</div>
                  </div>
                  <div>
                    <SLabel subtext={subtext}>CLIENTES</SLabel>
                    <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600 }}>
                      {schedule.sendToAll ? `Todos (${localCustomers.length})` : `${schedule.customerIds?.length || 0} selecionado(s)`}
                    </div>
                  </div>
                </div>

                <div style={{ background: `${accent}08`, borderRadius: 8, padding: 10, fontSize: 11.5, color: subtext, whiteSpace: "pre-wrap", marginBottom: 10 }}>
                  {schedule.text || "Nenhuma mensagem configurada."}
                </div>

                <button
                  onClick={() => startEdit(schedule)}
                  style={{ background: accent, color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontWeight: 700, fontSize: 11.5 }}
                >
                  <Edit2 size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
                  Editar programação
                </button>

                {editingId === schedule.id && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${border}` }}>
                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>DIAS DA SEMANA</SLabel>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, marginTop: 6 }}>
                        {WEEK_DAYS.map((day) => {
                          const unavailable = usedDays.includes(day.value);
                          const selected = editDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              disabled={unavailable}
                              onClick={() => !unavailable && toggleDay(day.value)}
                              style={{
                                background: selected ? `${accent}18` : unavailable ? `${border}50` : "transparent",
                                color: selected ? accent : unavailable ? subtext : text,
                                border: `1px solid ${selected ? accent : border}`,
                                borderRadius: 7,
                                padding: "8px 10px",
                                cursor: unavailable ? "not-allowed" : "pointer",
                                fontSize: 11.5,
                                textAlign: "left",
                                opacity: unavailable ? 0.45 : 1
                              }}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>HORÁRIO DO ENVIO</SLabel>
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        style={{ ...inputStyle(border, text), width: "100%", marginTop: 5 }}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>DESTINATÁRIOS (TELEFONES DOS CLIENTES)</SLabel>
                      <div style={{ display: "flex", gap: 15, marginTop: 6, marginBottom: 8 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", fontWeight: editSendToAll ? 600 : 400 }}>
                          <input
                            type="radio"
                            name={`sendToAll-${schedule.id}`}
                            checked={editSendToAll}
                            onChange={() => setEditSendToAll(true)}
                          />
                          Enviar para todos os clientes ({localCustomers.length})
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", fontWeight: !editSendToAll ? 600 : 400 }}>
                          <input
                            type="radio"
                            name={`sendToAll-${schedule.id}`}
                            checked={!editSendToAll}
                            onChange={() => setEditSendToAll(false)}
                          />
                          Selecionar clientes específicos
                        </label>
                      </div>

                      {!editSendToAll && (
                        <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: 10, background: `${card}aa` }}>
                          <div style={{ position: "relative", marginBottom: 8 }}>
                            <Search size={14} color={subtext} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                            <input
                              type="text"
                              placeholder="Buscar cliente por nome ou telefone..."
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              style={{ ...inputStyle(border, text), width: "100%", paddingLeft: 30, fontSize: 11.5 }}
                            />
                          </div>

                          <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                            {filteredCustomers.length === 0 ? (
                              <div style={{ fontSize: 11.5, color: subtext, textAlign: "center", padding: 10 }}>Nenhum cliente encontrado.</div>
                            ) : (
                              filteredCustomers.map((c) => {
                                const isSelected = editCustomerIds.includes(c.id);
                                return (
                                  <div
                                    key={c.id}
                                    onClick={() => toggleCustomer(c.id)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      background: isSelected ? `${accent}15` : "transparent",
                                      cursor: "pointer",
                                      fontSize: 11.5
                                    }}
                                  >
                                    <div>
                                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                                      <span style={{ color: subtext, marginLeft: 8 }}>{c.phone || "Sem telefone"}</span>
                                    </div>
                                    {isSelected && <Check size={14} color={accent} />}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: subtext, marginTop: 6 }}>
                            {editCustomerIds.length} cliente(s) selecionado(s).
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>MENSAGEM (Variáveis: {"{nome}"}, {"{saldo}"})</SLabel>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={5}
                        style={{ ...inputStyle(border, text), width: "100%", marginTop: 5, fontFamily: FONT_BODY }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => saveEdit(schedule.id)}
                        style={{ background: accent, border: "none", borderRadius: 7, padding: "8px 13px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11.5 }}
                      >
                        <Save size={13} style={{ verticalAlign: "middle", marginRight: 5 }} /> Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 7, padding: "8px 13px", color: text, fontWeight: 700, cursor: "pointer", fontSize: 11.5 }}
                      >
                        <X size={13} style={{ verticalAlign: "middle", marginRight: 5 }} /> Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { WhatsApp };