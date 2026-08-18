// @ts-nocheck

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Users,
  Package,
  ShoppingCart,
  BarChart3,
  Store,
  MessageCircle,
  Gift,
  Printer,
  Plus,
  Search,
  Moon,
  Sun,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  Award,
  Percent,
  Eye,
  EyeOff,
  Edit2,
  Check,
  User,
  Lock,
  Menu,
  Bell,
  Clipboard,
  MoreVertical,
  Tag,
  Heart,
  ScanLine,
  List,
  History,
  LayoutGrid,
  TrendingUp,
  Share2,
  Calculator,
  CreditCard,
  Truck,
  Video,
  Music,
  Type,
  Mail,
  Wallet,
  Banknote,
  Save
} from "lucide-react";

import {
  FONT_BODY,
  FONT_DISPLAY,
  SUCCESS,
  DANGER,
  CHANNELS,
  GENDERS,
  FULFILLMENTS,
  MONTH_NAMES,
  MONTH_SHORT,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  seedCustomers,
  seedProducts,
  seedSellers,
  paymentMethods,
  HOUR_WEIGHTS,
  DOW_WEIGHTS,
  HOUR_SLOTS,
  CHANNEL_WEIGHTS,
  GENDER_WEIGHTS,
  FULFILL_WEIGHTS,
  PRESET_COLORS,
  seedSales,
  allSeedSales,
  seedAdEntries,
  seedFiados
} from "../data/constants";

import {
  money,
  formatDateShort,
  formatDateBadge,
  formatDateLong,
  inPeriod,
  sameOrBefore,
  sendWhatsAppMessage,
  sendSMS,
  fiadoDate,
  inputStyle,
  lbl,
  ghostBtn,
  hexAlpha
} from "../utils/helpers";

import {
  SectionTitle,
  StatCard,
  FinanceRow,
  HBar,
  WaveChart,
  Pill,
  SLabel,
  PeriodHeader,
  PeriodModal,
  SingleDatePicker,
  MenuGridScreen,
  LogoMark,
  VipWelcome
} from "../components/common";

import type {
  Product,
  Customer,
  Seller,
  Sale,
  StockLocation,
  AdEntry,
  WaScheduleEntry,
  WelcomeConfig
} from "../types";


function Fiados({
  fiados,
  setFiados,
  customers,
  card,
  border,
  subtext,
  accent,
  text
}) {
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [products, setProducts] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");

  const add = () => {
    if (!customerId || !value) return;
    const c = customers.find((c) => c.id === customerId);
    const d = dueDate
      ? new Date(dueDate + "T12:00:00")
      : new Date();
    const item = {
      id: "fd" + Date.now(),
      customerId,
      customerName: c?.name || "Cliente",
      date: new Date(),
      products,
      origin: "manual",
      installments: [{ value: Number(value) || 0, dueDate: d, paid: false }]
    };
    setFiados((prev) => [...prev, item]);
    setShowForm(false);
    setProducts("");
    setValue("");
    setDueDate("");
  };

  const toggle = (id) =>
    setFiados((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              installments: f.installments.map((i, idx) =>
                idx === 0 ? { ...i, paid: !i.paid } : i
              )
            }
          : f
      )
    );

  return (
    <div>
      <SectionTitle
        title="Fiados"
        sub="Contas pendentes e parcelas"
        subtext={subtext}
      />

      <button
        onClick={() => setShowForm((v) => !v)}
        style={{
          background: accent,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "9px 14px",
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 14
        }}
      >
        {showForm ? "Cancelar" : "Novo fiado"}
      </button>

      {showForm && (
        <div
          style={{
            background: card,
            border: "1px solid " + border,
            borderRadius: 12,
            padding: 16,
            marginBottom: 16
          }}
        >
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ width: "100%", padding: 9, marginBottom: 8 }}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            value={products}
            onChange={(e) => setProducts(e.target.value)}
            placeholder="Produtos"
            style={{ width: "100%", padding: 9, marginBottom: 8 }}
          />

          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            placeholder="Valor"
            style={{ width: "100%", padding: 9, marginBottom: 8 }}
          />

          <input
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            type="date"
            style={{ width: "100%", padding: 9, marginBottom: 8 }}
          />

          <button
            onClick={add}
            style={{
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 14px",
              fontWeight: 700
            }}
          >
            Salvar
          </button>
        </div>
      )}

      {fiados.length === 0 ? (
        <div style={{ color: subtext }}>Nenhum fiado cadastrado.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {fiados.map((f) => (
            <div
              key={f.id}
              style={{
                background: card,
                border: "1px solid " + border,
                borderRadius: 12,
                padding: 14
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{f.customerName}</strong>
                <span>
                  {money(
                    f.installments.reduce((a, i) => a + i.value, 0)
                  )}
                </span>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: subtext,
                  margin: "6px 0"
                }}
              >
                {f.products || "Sem descrição"}
              </div>

              {f.installments.map((i, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12
                  }}
                >
                  <span>{formatDateShort(i.dueDate)}</span>
                  <span style={{ color: i.paid ? SUCCESS : DANGER }}>
                    {i.paid ? "Pago" : "Pendente"}
                  </span>
                  <button
                    onClick={() => toggle(f.id)}
                    style={{
                      border: "1px solid " + border,
                      background: "transparent",
                      color: text,
                      borderRadius: 6,
                      padding: "4px 7px",
                      cursor: "pointer"
                    }}
                  >
                    {i.paid ? "Reabrir" : "Marcar pago"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { Fiados };