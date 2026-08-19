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


const CAT_COLORS = {
  Proteínas: { main: "#DC2626", dark: "#7F1D1D", abbr: "PRO" },
  Creatina: { main: "#2563EB", dark: "#1E3A8A", abbr: "CRE" },
  "Pré-treino": { main: "#0F766E", dark: "#134E4A", abbr: "PRÉ" },
  Aminoácidos: { main: "#6B7280", dark: "#374151", abbr: "AMI" },
  Serviços: { main: "#78716C", dark: "#44403C", abbr: "SER" },
  Emagrecimento: { main: "#EA580C", dark: "#7C2D12", abbr: "EMA" },
  "Saúde e bem-estar": { main: "#059669", dark: "#064E3B", abbr: "S&B" }
};

const NEUTRAL_TILE = { main: "#9CA3AF", dark: "#4B5563" };

function catColor(cat) {
  return (
    CAT_COLORS[cat] || {
      main: "#7C3AED",
      dark: "#4C1D95",
      abbr: cat.slice(0, 3).toUpperCase()
    }
  );
}

function CatTile({ label, abbr, Icon, colors, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 10,
        overflow: "hidden",
        border: "none",
        cursor: "pointer",
        padding: 0,
        minHeight: 72
      }}
    >
      <div
        style={{
          flex: 1,
          background: colors.main,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          padding: 10
        }}
      >
        {Icon ? (
          <Icon size={22} />
        ) : (
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20 }}>
            {abbr}
          </span>
        )}
      </div>
      <div
        style={{
          background: colors.dark,
          color: "#fff",
          fontSize: 9.5,
          fontWeight: 700,
          textAlign: "center",
          padding: "5px 3px",
          lineHeight: 1.2
        }}
      >
        {label.toUpperCase()}
      </div>
    </button>
  );
}

export function PDV({
  device,
  products,
  customers,
  setCustomers,
  sellers,
  sales,
  setSales,
  cashbackPct,
  card,
  border,
  subtext,
  accent,
  text,
  dark
}) {
  const [step, setStep] = useState("gate");
  const [phoneQuery, setPhoneQuery] = useState("");
  const [foundCustomer, setFoundCustomer] = useState(null);
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [regTab, setRegTab] = useState("dados");
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    birth: "",
    sex: "Masculino",
    cpf: "",
    email: "",
    group: "Tipo único",
    descontoAtivo: false,
    descontoPct: "0",
    descontoValidade: "",
    fiadoAtivo: false,
    fiadoLimite: "100",
    fiadoValidade: "",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: ""
  });

  const search = () => {
    const match = customers.find(
      (c) =>
        c.phone.replace(/\D/g, "").includes(phoneQuery.replace(/\D/g, "")) &&
        phoneQuery.length >= 3
    );
    setFoundCustomer(match || null);
    if (!match) setRegForm((f) => ({ ...f, phone: phoneQuery }));
  };

  const confirmFound = () => {
    setActiveCustomerId(foundCustomer.id);
    setStep("order");
  };

  const goRegister = () => setStep("register");

  const skipRegister = () => {
    setActiveCustomerId(null);
    setStep("order");
  };

  const saveRegister = () => {
    if (!regForm.name || !regForm.phone) return;
    const newCust = {
      id: "c" + Date.now(),
      name: regForm.name,
      phone: regForm.phone,
      cpf: regForm.cpf,
      cashback: 0,
      sex: regForm.sex,
      fiadoAtivo: regForm.fiadoAtivo,
      fiadoLimite: parseFloat(regForm.fiadoLimite) || 0
    };
    setCustomers((prev) => [...prev, newCust]);
    setActiveCustomerId(newCust.id);
    setStep("order");
  };

  const backToGate = () => {
    setStep("gate");
    setPhoneQuery("");
    setFoundCustomer(null);
    setActiveCustomerId(null);
    setRegTab("dados");
  };

  useEffect(() => {
    if (step !== "register") return;
    const handler = (e) => {
      if (e.key === "Escape") backToGate();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveRegister();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (step === "gate") {
    const big = device === "desktop";
    return (
      <div>
        <SectionTitle
          title="PDV — Ponto de venda"
          sub="Busque o telefone do cliente para iniciar o pedido"
          subtext={subtext}
        />
        <div
          style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: big ? 18 : 14,
            padding: big ? 44 : 20,
            maxWidth: big ? 560 : "100%"
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: big ? 26 : 18,
              letterSpacing: 1,
              marginBottom: big ? 8 : 4
            }}
          >
            DADOS DO CLIENTE
          </div>
          <div
            style={{
              fontSize: big ? 14.5 : 12.5,
              color: subtext,
              marginBottom: big ? 24 : 16
            }}
          >
            Digite o telefone para localizar ou iniciar um novo cadastro
          </div>
          <label style={{ ...lbl(subtext), fontSize: big ? 12.5 : 10.5 }}>
            TELEFONE
          </label>
          <div
            style={{
              display: "flex",
              gap: big ? 12 : 8,
              marginTop: 4,
              marginBottom: big ? 20 : 14
            }}
          >
            <input
              value={phoneQuery}
              onChange={(e) => {
                setPhoneQuery(e.target.value);
                setFoundCustomer(null);
              }}
              placeholder="(00) 00000-0000"
              style={{
                ...inputStyle(border, text),
                flex: 1,
                fontSize: big ? 16 : 13,
                padding: big ? "13px 14px" : "8px 10px"
              }}
            />
            <button
              onClick={search}
              style={{
                background: accent,
                border: "none",
                borderRadius: 8,
                padding: big ? "0 22px" : "0 14px",
                cursor: "pointer"
              }}
            >
              <Search size={big ? 22 : 16} color="#fff" />
            </button>
          </div>
          {phoneQuery.length >= 3 && foundCustomer && (
            <div
              style={{
                background: `${accent}14`,
                border: `1px solid ${accent}44`,
                borderRadius: 10,
                padding: big ? 18 : 12,
                marginBottom: 12
              }}
            >
            </div>
          )}
        </div>
      </div>
    );
  }
}

