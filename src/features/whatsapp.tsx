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
  MessageCircle
} from "lucide-react";

import { FONT_BODY, SUCCESS } from "../data/constants";
import { inputStyle } from "../utils/helpers";
import { SectionTitle, Pill, SLabel } from "../components/common";

/* =========================================================
   DIAS DA SEMANA
   ========================================================= */

const WEEK_DAYS = [
  { value: "segunda", label: "Segunda-feira" },
  { value: "terça", label: "Terça-feira" },
  { value: "quarta", label: "Quarta-feira" },
  { value: "quinta", label: "Quinta-feira" },
  { value: "sexta", label: "Sexta-feira" },
  { value: "sábado", label: "Sábado" },
  { value: "domingo", label: "Domingo" }
];

/* =========================================================
   MENSAGEM PADRÃO
   ========================================================= */

const DEFAULT_MESSAGE =
  "Olá {nome}! 👋\n\n" +
  "Temos novidades especiais para você na BYSE PRO.\n\n" +
  "Passe para conferir nossas ofertas e aproveite seu cashback! 🎁";

/* =========================================================
   NOVA PROGRAMAÇÃO
   ========================================================= */

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

/* =========================================================
   COMPONENTE PRINCIPAL
   ========================================================= */

function WhatsApp({
  waSchedule,
  setWaSchedule,
  cashbackValidityDays,
  card,
  border,
  subtext,
  accent,
  text,
  customers = [],
  onGoCustomers
}) {
  /* ---------------------------------------------
     GARANTIR 3 PROGRAMAÇÕES (E MIGRAR "day" ANTIGO)
     --------------------------------------------- */

  const normalizedSchedule = useMemo(() => {
    const current = (Array.isArray(waSchedule) ? waSchedule : []).map(
      (item, index) => ({
        ...createSchedule(index + 1),
        ...item,
        days: Array.isArray(item?.days)
          ? item.days
          : item?.day
          ? [item.day]
          : []
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

  /* ---------------------------------------------
     ESTADOS DA INTERFACE
     --------------------------------------------- */

  const [editingId, setEditingId] = useState(null);
  const [editDays, setEditDays] = useState([]);
  const [editTime, setEditTime] = useState("10:00");
  const [editText, setEditText] = useState("");
  const [editSendToAll, setEditSendToAll] = useState(true);
  const [editCustomerIds, setEditCustomerIds] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomers, setShowCustomers] = useState(false);

  /* ---------------------------------------------
     DIAS JÁ UTILIZADOS POR OUTRAS PROGRAMAÇÕES
     --------------------------------------------- */

  const getUsedDays = (currentId) =>
    normalizedSchedule
      .filter((schedule) => schedule.id !== currentId)
      .flatMap((schedule) =>
        Array.isArray(schedule.days) ? schedule.days : []
      );

  /* ---------------------------------------------
     SELEÇÃO DE DIAS
     --------------------------------------------- */

  const toggleDay = (day) => {
    setEditDays((current) => {
      const days = Array.isArray(current) ? current : [];

      if (days.includes(day)) {
        return days.filter((item) => item !== day);
      }

      return [...days, day].sort(
        (a, b) =>
          WEEK_DAYS.findIndex((d) => d.value === a) -
          WEEK_DAYS.findIndex((d) => d.value === b)
      );
    });
  };

  /* ---------------------------------------------
     EDIÇÃO
     --------------------------------------------- */

  const startEdit = (schedule) => {
    setEditingId(schedule.id);
    setEditDays(Array.isArray(schedule.days) ? [...schedule.days] : []);
    setEditTime(schedule.time || "10:00");
    setEditText(schedule.text || DEFAULT_MESSAGE);
    setEditSendToAll(schedule.sendToAll !== false);
    setEditCustomerIds(
      Array.isArray(schedule.customerIds) ? [...schedule.customerIds] : []
    );
    setCustomerSearch("");
    setShowCustomers(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDays([]);
    setEditTime("10:00");
    setEditText("");
    setEditSendToAll(true);
    setEditCustomerIds([]);
    setCustomerSearch("");
    setShowCustomers(false);
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
      alert("Selecione pelo menos um cliente.");
      return;
    }

    setWaSchedule(
      normalizedSchedule.map((schedule) =>
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
      )
    );

    cancelEdit();
  };

  /* ---------------------------------------------
     ATIVAR / PAUSAR
     --------------------------------------------- */

  const toggle = (id) => {
    const schedule = normalizedSchedule.find((item) => item.id === id);

    if (!schedule) return;

    if (!schedule.enabled && !schedule.days?.length) {
      startEdit(schedule);
      return;
    }

    if (!schedule.enabled) {
      const usedDays = getUsedDays(id);
      const conflict = schedule.days.some((day) => usedDays.includes(day));

      if (conflict) {
        alert(
          "Um ou mais dias desta programação já estão sendo utilizados por outra mensagem."
        );
        return;
      }
    }

    setWaSchedule(
      normalizedSchedule.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  /* ---------------------------------------------
     CLIENTES
     --------------------------------------------- */

  const toggleCustomer = (customerId) => {
    setEditCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId]
    );
  };

  const selectAllCustomers = () => {
    setEditSendToAll(true);
    setEditCustomerIds([]);
  };

  const selectSpecificCustomers = () => {
    setEditSendToAll(false);
  };

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.toLowerCase().trim();

    if (!search) return customers;

    return customers.filter((customer) => {
      const name = String(customer.name || "").toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
  }, [customers, customerSearch]);

  /* ---------------------------------------------
     RÓTULO DOS DIAS
     --------------------------------------------- */

  const getDaysLabel = (days) => {
    if (!Array.isArray(days) || days.length === 0) {
      return "Nenhum dia selecionado";
    }

    return days
      .map(
        (day) =>
          WEEK_DAYS.find((item) => item.value === day)?.label || day
      )
      .join(", ");
  };

  /* ---------------------------------------------
     RENDERIZAÇÃO
     --------------------------------------------- */

  return (
    <div>
      <SectionTitle
        title="Integração com WhatsApp"
        sub="Mensagens automáticas — até três programações por semana"
        subtext={subtext}
      />

      <div
        style={{
          background: `${accent}12`,
          border: `1px solid ${accent}40`,
          borderRadius: 10,
          padding: 14,
          fontSize: 12.5,
          color: text,
          marginBottom: 16
        }}
      >
        <strong>Programação de mensagens</strong>

        <div style={{ marginTop: 5, lineHeight: 1.5 }}>
          Você pode criar até três programações. Os dias escolhidos em uma
          programação não ficam disponíveis nas outras.
          <br />
          O envio real dependerá da integração com a API oficial do WhatsApp
          Business.
          <br />
          A validade atual do cashback é de{" "}
          <strong>{cashbackValidityDays}</strong> dias.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {normalizedSchedule.map((schedule, index) => {
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
              {/* CABEÇALHO */}
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
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap"
                    }}
                  >
                    <MessageCircle size={16} color={accent} />
                    {schedule.label}
                    <Pill color={schedule.enabled ? SUCCESS : subtext}>
                      {schedule.enabled ? "Ativo" : "Pausado"}
                    </Pill>
                  </div>

                  <div
                    style={{ fontSize: 11, color: subtext, marginTop: 4 }}
                  >
                    Programação {index + 1} de 3
                  </div>
                </div>

                <label
                  style={{
                    position: "relative",
                    display: "inline-block",
                    width: 38,
                    height: 21,
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => toggle(schedule.id)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />

                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: schedule.enabled ? accent : "#ccc",
                      borderRadius: 20,
                      transition: ".2s"
                    }}
                  />

                  <span
                    style={{
                      position: "absolute",
                      height: 15,
                      width: 15,
                      left: schedule.enabled ? 20 : 3,
                      bottom: 3,
                      background: "#fff",
                      borderRadius: "50%",
                      transition: ".2s"
                    }}
                  />
                </label>
              </div>

              {/* CONTEÚDO */}
              <div style={{ padding: 14 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                    marginBottom: 12
                  }}
                >
                  <div>
                    <SLabel subtext={subtext}>DIAS</SLabel>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12.5,
                        fontWeight: 600
                      }}
                    >
                      {getDaysLabel(schedule.days)}
                    </div>
                  </div>

                  <div>
                    <SLabel subtext={subtext}>HORÁRIO</SLabel>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12.5,
                        fontWeight: 600
                      }}
                    >
                      {schedule.time || "10:00"}
                    </div>
                  </div>

                  <div>
                    <SLabel subtext={subtext}>CLIENTES</SLabel>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12.5,
                        fontWeight: 600
                      }}
                    >
                      {schedule.sendToAll
                        ? `Todos (${customers.length})`
                        : `${schedule.customerIds?.length || 0} selecionado(s)`}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: `${accent}08`,
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 11.5,
                    color: subtext,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                    marginBottom: 10
                  }}
                >
                  {schedule.text || "Nenhuma mensagem configurada."}
                </div>

                <button
                  onClick={() => startEdit(schedule)}
                  style={{
                    background: accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    padding: "7px 12px",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11.5
                  }}
                >
                  <Edit2
                    size={13}
                    style={{ verticalAlign: "middle", marginRight: 5 }}
                  />
                  Editar programação
                </button>

                {/* EDITOR */}
                {editingId === schedule.id && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: `1px solid ${border}`
                    }}
                  >
                    {/* DIAS */}
                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>DIAS DA SEMANA</SLabel>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: 7,
                          marginTop: 6
                        }}
                      >
                        {WEEK_DAYS.map((day) => {
                          const unavailable = usedDays.includes(day.value);
                          const selected = editDays.includes(day.value);

                          return (
                            <button
                              key={day.value}
                              type="button"
                              disabled={unavailable}
                              onClick={() => {
                                if (unavailable) return;
                                toggleDay(day.value);
                              }}
                              style={{
                                background: selected
                                  ? `${accent}18`
                                  : unavailable
                                  ? `${border}50`
                                  : "transparent",
                                color: selected
                                  ? accent
                                  : unavailable
                                  ? subtext
                                  : text,
                                border: `1px solid ${
                                  selected ? accent : border
                                }`,
                                borderRadius: 7,
                                padding: "8px 10px",
                                cursor: unavailable
                                  ? "not-allowed"
                                  : "pointer",
                                fontSize: 11.5,
                                fontWeight: selected ? 700 : 500,
                                opacity: unavailable ? 0.45 : 1,
                                textAlign: "left"
                              }}
                            >
                              {selected && (
                                <Check
                                  size={13}
                                  style={{
                                    verticalAlign: "middle",
                                    marginRight: 5
                                  }}
                                />
                              )}
                              {day.label}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          fontSize: 10.5,
                          color: subtext,
                          marginTop: 5
                        }}
                      >
                        Os dias usados pelas outras programações ficam
                        desabilitados.
                      </div>
                    </div>

                    {/* HORÁRIO */}
                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>HORÁRIO DO ENVIO</SLabel>

                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        style={{
                          ...inputStyle(border, text),
                          width: "100%",
                          marginTop: 5
                        }}
                      />
                    </div>

                    {/* CLIENTES */}
                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>CLIENTES QUE RECEBERÃO</SLabel>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 6,
                          flexWrap: "wrap"
                        }}
                      >
                        <button
                          type="button"
                          onClick={selectAllCustomers}
                          style={{
                            background: editSendToAll
                              ? `${accent}18`
                              : "transparent",
                            color: editSendToAll ? accent : text,
                            border: `1px solid ${
                              editSendToAll ? accent : border
                            }`,
                            borderRadius: 7,
                            padding: "7px 10px",
                            cursor: "pointer",
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          <Users
                            size={13}
                            style={{
                              verticalAlign: "middle",
                              marginRight: 5
                            }}
                          />
                          Todos os clientes
                        </button>

                        <button
                          type="button"
                          onClick={selectSpecificCustomers}
                          style={{
                            background: !editSendToAll
                              ? `${accent}18`
                              : "transparent",
                            color: !editSendToAll ? accent : text,
                            border: `1px solid ${
                              !editSendToAll ? accent : border
                            }`,
                            borderRadius: 7,
                            padding: "7px 10px",
                            cursor: "pointer",
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          <User
                            size={13}
                            style={{
                              verticalAlign: "middle",
                              marginRight: 5
                            }}
                          />
                          Escolher clientes
                        </button>

                        <button
                          type="button"
                          onClick={() => onGoCustomers?.()}
                          style={{
                            background: "transparent",
                            color: accent,
                            border: `1px solid ${accent}`,
                            borderRadius: 7,
                            padding: "7px 10px",
                            cursor: "pointer",
                            fontSize: 11.5,
                            fontWeight: 700
                          }}
                        >
                          <Plus
                            size={13}
                            style={{
                              verticalAlign: "middle",
                              marginRight: 5
                            }}
                          />
                          Cadastrar cliente
                        </button>
                      </div>

                      {editSendToAll && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: 10,
                            background: `${SUCCESS}10`,
                            border: `1px solid ${SUCCESS}35`,
                            borderRadius: 8,
                            fontSize: 11.5,
                            color: subtext
                          }}
                        >
                          <Check
                            size={14}
                            color={SUCCESS}
                            style={{
                              verticalAlign: "middle",
                              marginRight: 5
                            }}
                          />
                          A mensagem será enviada para todos os clientes
                          cadastrados.
                          <br />
                          Total de clientes:{" "}
                          <strong>{customers.length}</strong>
                        </div>
                      )}

                      {!editSendToAll && (
                        <div
                          style={{
                            marginTop: 8,
                            border: `1px solid ${border}`,
                            borderRadius: 9,
                            padding: 10
                          }}
                        >
                          <div style={{ display: "flex", gap: 7 }}>
                            <div style={{ position: "relative", flex: 1 }}>
                              <Search
                                size={14}
                                color={subtext}
                                style={{
                                  position: "absolute",
                                  left: 9,
                                  top: 10
                                }}
                              />

                              <input
                                value={customerSearch}
                                onChange={(e) =>
                                  setCustomerSearch(e.target.value)
                                }
                                placeholder="Pesquisar cliente..."
                                style={{
                                  ...inputStyle(border, text),
                                  width: "100%",
                                  paddingLeft: 30
                                }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowCustomers(!showCustomers)}
                              style={{
                                background: accent,
                                color: "#fff",
                                border: "none",
                                borderRadius: 7,
                                padding: "0 11px",
                                cursor: "pointer"
                              }}
                            >
                              {showCustomers ? "Fechar" : "Selecionar"}
                            </button>
                          </div>

                          {showCustomers && (
                            <div
                              style={{
                                marginTop: 9,
                                maxHeight: 250,
                                overflowY: "auto",
                                borderTop: `1px solid ${border}`
                              }}
                            >
                              {filteredCustomers.length === 0 ? (
                                <div
                                  style={{
                                    padding: 15,
                                    textAlign: "center",
                                    color: subtext,
                                    fontSize: 11.5
                                  }}
                                >
                                  Nenhum cliente encontrado.
                                  <br />
                                  <button
                                    type="button"
                                    onClick={() => onGoCustomers?.()}
                                    style={{
                                      marginTop: 8,
                                      background: "transparent",
                                      color: accent,
                                      border: "none",
                                      cursor: "pointer",
                                      textDecoration: "underline"
                                    }}
                                  >
                                    Cadastrar novo cliente
                                  </button>
                                </div>
                              ) : (
                                filteredCustomers.map((customer) => {
                                  const selected = editCustomerIds.includes(
                                    customer.id
                                  );

                                  return (
                                    <label
                                      key={customer.id}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 9,
                                        padding: "9px 5px",
                                        borderBottom: `1px solid ${border}`,
                                        cursor: "pointer"
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() =>
                                          toggleCustomer(customer.id)
                                        }
                                      />

                                      <div style={{ flex: 1 }}>
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            fontSize: 12
                                          }}
                                        >
                                          {customer.name}
                                        </div>

                                        <div
                                          style={{
                                            color: subtext,
                                            fontSize: 10.5,
                                            marginTop: 2
                                          }}
                                        >
                                          {customer.phone ||
                                            "Telefone não informado"}
                                        </div>
                                      </div>

                                      {selected && (
                                        <Check size={14} color={accent} />
                                      )}
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}

                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 10.5,
                              color: subtext
                            }}
                          >
                            {editCustomerIds.length} cliente(s)
                            selecionado(s).
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MENSAGEM */}
                    <div style={{ marginBottom: 12 }}>
                      <SLabel subtext={subtext}>MENSAGEM</SLabel>

                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={7}
                        placeholder="Digite a mensagem que será enviada..."
                        style={{
                          ...inputStyle(border, text),
                          width: "100%",
                          marginTop: 5,
                          fontFamily: FONT_BODY,
                          resize: "vertical",
                          lineHeight: 1.5
                        }}
                      />

                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 10.5,
                          color: subtext
                        }}
                      >
                        Você pode utilizar:
                        <br />
                        <strong>{"{nome}"}</strong> — nome do cliente
                        <br />
                        <strong>{"{saldo}"}</strong> — saldo de cashback
                        <br />
                        <strong>{"{produtos}"}</strong> — produtos da última
                        compra
                      </div>
                    </div>

                    {/* RESUMO */}
                    <div
                      style={{
                        background: `${accent}08`,
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 12,
                        fontSize: 11.5,
                        color: subtext
                      }}
                    >
                      <strong style={{ color: text }}>
                        Resumo da programação
                      </strong>
                      <br />
                      Dias: <strong>{getDaysLabel(editDays)}</strong>
                      <br />
                      Horário: <strong>{editTime}</strong>
                      <br />
                      Destinatários:{" "}
                      <strong>
                        {editSendToAll
                          ? `Todos os ${customers.length} clientes`
                          : `${editCustomerIds.length} cliente(s)`}
                      </strong>
                    </div>

                    {/* BOTÕES */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => saveEdit(schedule.id)}
                        style={{
                          background: accent,
                          border: "none",
                          borderRadius: 7,
                          padding: "8px 13px",
                          color: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 11.5
                        }}
                      >
                        <Save
                          size={13}
                          style={{ verticalAlign: "middle", marginRight: 5 }}
                        />
                        Salvar programação
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={{
                          background: "transparent",
                          border: `1px solid ${border}`,
                          borderRadius: 7,
                          padding: "8px 13px",
                          color: text,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 11.5
                        }}
                      >
                        <X
                          size={13}
                          style={{ verticalAlign: "middle", marginRight: 5 }}
                        />
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* INFORMAÇÕES FINAIS */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          border: `1px solid ${border}`,
          borderRadius: 10,
          fontSize: 11,
          color: subtext,
          lineHeight: 1.5
        }}
      >
        <strong style={{ color: text }}>Como funciona:</strong>
        <br />
        1. Escolha um ou mais dias para cada programação.
        <br />
        2. Um dia escolhido não fica disponível nas outras programações.
        <br />
        3. Defina o horário.
        <br />
        4. Escolha todos os clientes ou somente alguns.
        <br />
        5. Escreva ou edite a mensagem.
        <br />
        6. Salve a programação.
        <br />
        7. O sistema poderá utilizar essas configurações posteriormente para
        realizar os disparos pelo WhatsApp.
      </div>
    </div>
  );
}

export { WhatsApp };
