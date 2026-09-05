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
  Save,
  ExternalLink
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
  paymentMethods,
  PRESET_COLORS
} from "../data/constants";

import {
  money,
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


export function Catalogo({
  products: initialProducts,
  sales,
  card,
  border,
  subtext,
  accent,
  text,
  dark,
  device
}) {
  const [products, setProducts] = useState(initialProducts || []);
  const [showPrices, setShowPrices] = useState(true);
  const [banner, setBanner] = useState({
    storeName: "Minha Loja de Suplementos",
    tagline: "Os melhores suplementos da região",
    imageUrl: null
  });
  const [showBannerEdit, setShowBannerEdit] = useState(false);
  const [vipPassword, setVipPassword] = useState("vip123");
  const [vipUnlocked, setVipUnlocked] = useState(false);
  const [showVipModal, setShowVipModal] = useState(false);
  const [showVipConfig, setShowVipConfig] = useState(false);
  const [vipInput, setVipInput] = useState("");
  const [vipError, setVipError] = useState("");
  const [vipCart, setVipCart] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [showVipWelcome, setShowVipWelcome] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [vipPayment, setVipPayment] = useState(paymentMethods[0]);
  const [vipFulfillment, setVipFulfillment] = useState("Retirada");
  const [showWelcomeEdit, setShowWelcomeEdit] = useState(false);
  const [welcome, setWelcome] = useState({
    mode: "text",
    line1: "SEJA BEM-VINDO",
    line2: "CLUBE BYSE",
    line3: "Você é nosso",
    line4: "Cliente VIP",
    videoUrl: null,
    audioUrl: null
  });

  // Se o usuário estiver acessando via link público na URL (ex: /catalogo/:userId)
  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const publicUserId = pathParts[pathParts.indexOf('catalogo') + 1];
    
    if (publicUserId) {
      setPreviewMode(true);
      fetch(`/api/public/catalogo/${publicUserId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.products) {
            setProducts(data.products);
          }
          if (data && data.storeName) {
            setBanner(b => ({ ...b, storeName: data.storeName }));
          }
        })
        .catch(err => console.error("Erro ao carregar catálogo público:", err));
    }
  }, []);

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const catalogLink = window.location.href.includes('/catalogo/') 
    ? window.location.href 
    : "https://byse-pro-finale-nowo-seven.vercel.app/catalogo/1787335620584";

  const copyLink = () => {
    navigator.clipboard?.writeText(catalogLink);
  };

  const shareWhatsApp = () =>
    window.open(
      `https://wa.me/83986441546?text=${encodeURIComponent(
        "Olá! Gostaria de consultar o preço dos produtos no catálogo."
      )}`,
      "_blank"
    );

  const handleBannerImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setBanner((b) => ({ ...b, imageUrl: r.result }));
    r.readAsDataURL(file);
  };

  const checkVip = () => {
    const matchCode = products.some((p) => p.code && p.code.trim() === vipInput.trim());
    if (vipInput === vipPassword || matchCode) {
      setVipUnlocked(true);
      setShowVipModal(false);
      setVipInput("");
      setVipError("");
      setShowVipWelcome(true);
    } else {
      setVipError("Código ou senha incorreta");
    }
  };

  const handleWelcomeVideo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setWelcome((w) => ({ ...w, videoUrl: r.result }));
    r.readAsDataURL(f);
  };

  const handleWelcomeAudio = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setWelcome((w) => ({ ...w, audioUrl: r.result }));
    r.readAsDataURL(f);
  };

  const addVip = (p) =>
    setVipCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      const unitPrice = p.vipPrice ?? p.price;
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          price: unitPrice,
          originalPrice: p.price,
          qty: 1
        }
      ];
    });

  const removeVip = (idx) =>
    setVipCart(vipCart.filter((_, i) => i !== idx));

  const vipTotal = vipCart.reduce((s, it) => s + it.price * it.qty, 0);
  const vipSavings = vipCart.reduce(
    (s, it) => s + (it.originalPrice - it.price) * it.qty,
    0
  );

  const cheapest = products
    .filter((p) => !vipCart.some((it) => it.productId === p.id))
    .sort((a, b) => (a.vipPrice ?? a.price) - (b.vipPrice ?? b.price))[0];

  const checkoutVip = () => {
    const lines = vipCart
      .map((it) => `${it.qty}x ${it.name} — ${money(it.price * it.qty)}`)
      .join("\n");
    const msg = `Olá! Gostaria de fazer o seguinte pedido (preço VIP):\n${lines}\n\nVocê economiza: ${money(
      vipSavings
    )}\nTotal: ${money(vipTotal)}\nPagamento: ${vipPayment}\nEntrega: ${vipFulfillment}`;
    window.open(`https://wa.me/83986441546?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const activeProducts = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : [];

  const qtyByProduct = {};
  if (activeCategory) {
    (sales || []).forEach((s) =>
      (s.items || []).forEach((it) => {
        if (activeProducts.some((p) => p.id === it.productId)) {
          qtyByProduct[it.productId] =
            (qtyByProduct[it.productId] || 0) + it.qty;
        }
      })
    );
  }

  const topId = Object.entries(qtyByProduct).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  return (
    <div>
      <SectionTitle
        title="Catálogo"
        sub="Vitrine de produtos para compartilhar com clientes"
        subtext={subtext}
      />

      <div
        style={{
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: text, marginBottom: 2 }}>
            Link público do Catálogo para clientes:
          </div>
          <a
            href={catalogLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: accent, textDecoration: "underline", wordBreak: "break-all" }}
          >
            {catalogLink}
          </a>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copyLink} style={ghostBtn(border, text)}>
            <Clipboard size={14} /> Copiar link
          </button>
          <a
            href={catalogLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...ghostBtn(border, text),
              background: accent,
              color: "#fff",
              border: "none",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <ExternalLink size={14} /> Acessar catálogo
          </a>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 12,
          minHeight: 110,
          background: banner.imageUrl
            ? `url(${banner.imageUrl}) center/cover`
            : `linear-gradient(135deg, ${accent}, ${accent}99)`,
          display: "flex",
          alignItems: "flex-end",
          padding: 16
        }}
      >
        <div style={{ color: "#fff" }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 22,
              letterSpacing: 1
            }}
          >
            {banner.storeName}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            {banner.tagline}
          </div>
        </div>

        {!previewMode && (
          <button
            onClick={() => setShowBannerEdit(!showBannerEdit)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(0,0,0,.4)",
              border: "none",
              borderRadius: 7,
              padding: "5px 8px",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            <Edit2 size={13} />
          </button>
        )}
      </div>

      {previewMode && (
        <div
          style={{
            background: hexAlpha(accent, 0.12),
            border: `1px solid ${accent}55`,
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 11.5,
            color: text,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Eye size={13} color={accent} /> Modo pré-visualização — é assim que
          seus clientes veem o catálogo.
        </div>
      )}

      {!previewMode && showBannerEdit && (
        <div
          style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 16
          }}
        >
          <SLabel subtext={subtext}>Personalizar vitrine</SLabel>
          <input
            placeholder="Nome da loja"
            value={banner.storeName}
            onChange={(e) =>
              setBanner({ ...banner, storeName: e.target.value })
            }
            style={{
              ...inputStyle(border, text),
              width: "100%",
              marginBottom: 8
            }}
          />
          <input
            placeholder="Frase de efeito"
            value={banner.tagline}
            onChange={(e) =>
              setBanner({ ...banner, tagline: e.target.value })
            }
            style={{
              ...inputStyle(border, text),
              width: "100%",
              marginBottom: 8
            }}
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerImage}
            style={{ fontSize: 12 }}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12
        }}
      >
        {!previewMode && (
          <button
            onClick={() => setShowPrices(!showPrices)}
            style={ghostBtn(border, text)}
          >
            {showPrices ? <Eye size={14} /> : <EyeOff size={14} />}{" "}
            {showPrices
              ? "Ocultar valores (catálogo normal)"
              : "Consultar valor (catálogo normal)"}
          </button>
        )}
        <button
          onClick={shareWhatsApp}
          style={{
            ...ghostBtn(border, text),
            background: "#25D366",
            color: "#fff",
            border: "none"
          }}
        >
          <MessageCircle size={14} /> Falar no WhatsApp (83986441546)
        </button>
        <button
          onClick={() => setShowVipModal(true)}
          style={{
            ...ghostBtn(border, text),
            background: vipUnlocked ? SUCCESS : accent,
            color: "#fff",
            border: "none"
          }}
        >
          <Lock size={14} /> {vipUnlocked ? "Cliente VIP ✓" : "Inserir Código VIP"}
        </button>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          style={{
            ...ghostBtn(border, text),
            background: previewMode ? accent : "transparent",
            color: previewMode ? "#fff" : text,
            border: previewMode ? "none" : `1px solid ${border}`
          }}
        >
          <Eye size={14} />{" "}
          {previewMode ? "Sair da visão do cliente" : "Visão do cliente"}
        </button>
        {!previewMode && (
          <button
            onClick={() => setShowWelcomeEdit(!showWelcomeEdit)}
            style={ghostBtn(border, text)}
          >
            <Video size={14} /> Boas-vindas VIP
          </button>
        )}
      </div>

      {!previewMode && showWelcomeEdit && (
        <div
          style={{
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 20
          }}
        >
          <SLabel subtext={subtext}>
            Animação de boas-vindas ao entrar no VIP
          </SLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setWelcome((w) => ({ ...w, mode: "text" }))}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px",
                borderRadius: 8,
                border: `1px solid ${
                  welcome.mode === "text" ? accent : border
                }`,
                background:
                  welcome.mode === "text" ? accent : "transparent",
                color: welcome.mode === "text" ? "#fff" : text,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <Type size={13} /> Texto
            </button>
            <button
              onClick={() => setWelcome((w) => ({ ...w, mode: "video" }))}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px",
                borderRadius: 8,
                border: `1px solid ${
                  welcome.mode === "video" ? accent : border
                }`,
                background:
                  welcome.mode === "video" ? accent : "transparent",
                color: welcome.mode === "video" ? "#fff" : text,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <Video size={13} /> Vídeo
            </button>
          </div>

          {welcome.mode === "text" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 12
              }}
            >
              <input
                placeholder="Linha 1 — pequena"
                value={welcome.line1}
                onChange={(e) =>
                  setWelcome((w) => ({ ...w, line1: e.target.value }))
                }
                style={{ ...inputStyle(border, text), width: "100%" }}
              />
              <input
                placeholder="Linha 2 — grande"
                value={welcome.line2}
                onChange={(e) =>
                  setWelcome((w) => ({ ...w, line2: e.target.value }))
                }
                style={{ ...inputStyle(border, text), width: "100%" }}
              />
              <input
                placeholder="Linha 3 — pequena"
                value={welcome.line3}
                onChange={(e) =>
                  setWelcome((w) => ({ ...w, line3: e.target.value }))
                }
                style={{ ...inputStyle(border, text), width: "100%" }}
              />
              <input
                placeholder="Linha 4 — grande"
                value={welcome.line4}
                onChange={(e) =>
                  setWelcome((w) => ({ ...w, line4: e.target.value }))
                }
                style={{ ...inputStyle(border, text), width: "100%" }}
              />
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  fontSize: 12,
                  color: subtext,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Video size={13} /> Vídeo de apresentação (poucos segundos)
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleWelcomeVideo}
                style={{ fontSize: 12, marginTop: 6 }}
              />
              {welcome.videoUrl && (
                <div
                  style={{
                    fontSize: 11,
                    color: SUCCESS,
                    marginTop: 4
                  }}
                >
                  ✓ Vídeo carregado
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: subtext,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Music size={13} /> Áudio (opcional, toca durante a animação)
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleWelcomeAudio}
              style={{ fontSize: 12, marginTop: 6 }}
            />
            {welcome.audioUrl && (
              <div
                style={{
                  fontSize: 11,
                  color: SUCCESS,
                  marginTop: 4
                }}
              >
                ✓ Áudio carregado
              </div>
            )}
          </div>

          <button
            onClick={() => setShowVipWelcome(true)}
            style={{
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            ▶ Testar animação
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: activeCategory ? 16 : 24,
          scrollbarWidth: "thin"
        }}
      >
        {categories.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(active ? null : cat)}
              style={{
                flexShrink: 0,
                padding: "9px 16px",
                borderRadius: 20,
                border: `1px solid ${active ? accent : border}`,
                background: active ? accent : "transparent",
                color: active ? "#fff" : text,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {!activeCategory && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: subtext,
            fontSize: 13
          }}
        >
          <Tag size={26} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>Selecione uma categoria acima para ver os produtos.</div>
        </div>
      )}

      {activeCategory && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(210px,1fr))",
              gap: 14
            }}
          >
            {activeProducts.map((p) => {
              const savings =
                p.vipPrice != null ? p.price - p.vipPrice : 0;
              const savingsPct =
                p.vipPrice != null ? (savings / p.price) * 100 : 0;
              const per3x =
                p.vipPrice3x != null
                  ? p.vipPrice3x
                  : null;

              return (
                <div
                  key={p.id}
                  style={{
                    background: card,
                    border:
                      p.id === topId
                        ? `2px solid ${accent}`
                        : `1px solid ${border}`,
                    borderRadius: 12,
                    padding: 16,
                    position: "relative"
                  }}
                >
                  {p.id === topId && (
                    <div
                      style={{
                        position: "absolute",
                        top: -9,
                        left: 14
                      }}
                    >
                      <Pill color={accent}>MAIS VENDIDO</Pill>
                    </div>
                  )}

                  <div
                    style={{
                      width: "100%",
                      height: 90,
                      borderRadius: 8,
                      marginBottom: 10,
                      overflow: "hidden",
                      background: p.imageUrl
                        ? undefined
                        : `${accent}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: accent
                    }}
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        style={{
                          width: "50%",
                          height: "100%",
                          objectFit: "cover"
                        }}
                      />
                    ) : (
                      <Package size={28} />
                    )}
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                    {p.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: subtext,
                      margin: "4px 0 8px"
                    }}
                  >
                    {p.description || "Produto de alta qualidade."}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 18,
                      color: accent
                    }}
                  >
                    {vipUnlocked || showPrices
                      ? money(p.price)
                      : "Consultar valor"}
                  </div>

                  {vipUnlocked && p.vipPrice != null && (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: `1px dashed ${border}`
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: subtext,
                          textDecoration: "line-through"
                        }}
                      >
                        De {money(p.price)}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 6,
                          flexWrap: "wrap"
                        }}
                      >
                        <Pill color={SUCCESS}>VIP</Pill>
                        <span
                          style={{
                            fontFamily: FONT_DISPLAY,
                            fontSize: 17,
                            color: SUCCESS
                          }}
                        >
                          {money(p.vipPrice)}
                        </span>
                        <span
                          style={{
                            fontSize: 10.5,
                            color: subtext
                          }}
                        >
                          Valor Vip À VISTA
                        </span>
                      </div>
                      {per3x != null && (
                        <div style={{ fontSize: 11, color: SUCCESS, fontWeight: 600, marginTop: 2 }}>
                          ou 3x de {money(per3x)} sem juros (VIP)
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 10.5,
                          color: SUCCESS,
                          fontWeight: 700,
                          marginTop: 2
                        }}
                      >
                        Economia de {money(savings)} ({savingsPct.toFixed(0)}
                        %)
                      </div>
                      <button
                        onClick={() => addVip(p)}
                        style={{
                          width: "100%",
                          marginTop: 8,
                          background: accent,
                          color: "#fff",
                          border: "none",
                          borderRadius: 7,
                          padding: "7px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        + Adicionar ao carrinho
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vipUnlocked && vipCart.length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: 8,
            background: card,
            border: `2px solid ${accent}`,
            borderRadius: 14,
            padding: 18,
            marginTop: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,.18)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12
            }}
          >
            <ShoppingCart size={16} color={accent} />
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 16,
                letterSpacing: 1
              }}
            >
              SEU CARRINHO VIP
            </span>
          </div>

          {vipCart.map((it, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderBottom: `1px dashed ${border}`
              }}
            >
              <Package
                size={13}
                color={subtext}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: 12.5 }}>
                {it.qty}x {it.name}
              </span>
              <span
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                {money(it.price * it.qty)}
                <button
                  onClick={() => removeVip(i)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  <X size={12} color={subtext} />
                </button>
              </span>
            </div>
          ))}

          {cheapest && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: `${accent}10`,
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8
              }}
            >
              <div style={{ fontSize: 11.5 }}>
                Que tal adicionar <b>{cheapest.name}</b> por só{" "}
                {money(cheapest.vipPrice ?? cheapest.price)}?
              </div>
              <button
                onClick={() => addVip(cheapest)}
                style={{
                  background: accent,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0
                }}
              >
                + Add
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${border}`
            }}
          >
            <label
              style={{
                fontSize: 11,
                color: subtext,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6
              }}
            >
              <CreditCard size={13} /> FORMA DE PAGAMENTO
            </label>
            <select
              value={vipPayment}
              onChange={(e) => setVipPayment(e.target.value)}
              style={{ ...inputStyle(border, text), width: "100%" }}
            >
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10 }}>
            <label
              style={{
                fontSize: 11,
                color: subtext,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6
              }}
            >
              <Truck size={13} /> ENTREGA
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {FULFILLMENTS.map((f) => {
                const activeF = vipFulfillment === f;
                const Icon = f === "Delivery" ? Truck : Store;
                return (
                  <button
                    key={f}
                    onClick={() => setVipFulfillment(f)}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "9px",
                      borderRadius: 8,
                      border: `1px solid ${
                        activeF ? accent : border
                      }`,
                      background: activeF ? accent : "transparent",
                      color: activeF ? "#fff" : text,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    <Icon size={14} /> {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${border}`
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: subtext
              }}
            >
              <span>Subtotal</span>
              <span>{money(vipTotal)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: SUCCESS,
                fontWeight: 700,
                marginTop: 3
              }}
            >
              <span>Você economiza</span>
              <span>{money(vipSavings)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 6
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 24 }}>
                {money(vipTotal)}
              </span>
            </div>
          </div>

          <button
            onClick={checkoutVip}
            style={{
              width: "100%",
              marginTop: 12,
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <MessageCircle size={16} /> Finalizar pedido no WhatsApp (83986441546)
          </button>
        </div>
      )}

      {showVipModal && (
        <div
          onClick={() => setShowVipModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: card,
              border: `1px solid ${border}`,
              borderRadius: 14,
              padding: 22,
              width: 300
            }}
          >
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 18,
                marginBottom: 4
              }}
            >
              ÁREA VIP / CÓDIGO DO CATÁLOGO
            </div>
            <div
              style={{
                fontSize: 12,
                color: subtext,
                marginBottom: 12
              }}
            >
              Digite o código do produto ou a senha VIP para desbloquear os preços exclusivos.
            </div>
            <input
              type="text"
              value={vipInput}
              onChange={(e) => {
                setVipInput(e.target.value);
                setVipError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && checkVip()}
              style={{
                ...inputStyle(border, text),
                width: "100%",
                marginBottom: 8
              }}
            />
            {vipError && (
              <div
                style={{
                  fontSize: 11.5,
                  color: DANGER,
                  marginBottom: 8
                }}
              >
                {vipError}
              </div>
            )}
            <button
              onClick={checkVip}
              style={{
                width: "100%",
                background: accent,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Entrar
            </button>
            {!previewMode && (
              <button
                onClick={() => setShowVipConfig(!showVipConfig)}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: subtext,
                  fontSize: 11,
                  marginTop: 10,
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Configurar senha (loja)
              </button>
            )}
            {!previewMode && showVipConfig && (
              <input
                value={vipPassword}
                onChange={(e) => setVipPassword(e.target.value)}
                style={{
                  ...inputStyle(border, text),
                  width: "100%",
                  marginTop: 8
                }}
              />
            )}
          </div>
        </div>
      )}

      {showVipWelcome && (
        <VipWelcome
          accent={accent}
          device={device}
          welcome={welcome}
          onDone={() => setShowVipWelcome(false)}
        />
      )}
    </div>
  );
}