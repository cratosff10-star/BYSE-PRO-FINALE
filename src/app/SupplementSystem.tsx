// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Users, Package, ShoppingCart, BarChart3, Store, MessageCircle, Gift, Printer, Plus, Search, Moon, Sun, Trash2, X, ChevronRight, ChevronLeft, Award, Percent, Eye, EyeOff, Edit2, Check, User, Lock, Menu, Bell, Clipboard, MoreVertical, Tag, Heart, ScanLine, List, History, LayoutGrid, TrendingUp, Share2, Calculator, CreditCard, Truck, Video, Music, Type, Mail, Wallet, Banknote, Save, LogOut } from "lucide-react";
import { FONT_BODY, FONT_DISPLAY, SUCCESS, DANGER, GLOBAL_CSS, seedProducts, seedCustomers, seedSellers, CHANNELS, GENDERS, FULFILLMENTS, allSeedSales, seedFiados, seedAdEntries, PRESET_COLORS } from "../data/constants";
import { money, genNoiseSales, genAdEntries, inPeriod } from "../utils/helpers";
import { LoginScreen, VipWelcome, MenuGridScreen, LogoMark, SLabel } from "../components/common";
import { Dashboard } from "../features/dashboard"; import { Clientes } from "../features/clientes"; import { Estoque } from "../features/estoque"; import { PDV } from "../features/pdv"; import { Vendedores } from "../features/vendedores"; import { Catalogo } from "../features/catalogo"; import { Cashback } from "../features/cashback"; import { WhatsApp } from "../features/whatsapp"; import { TrafegoPago, CanaisDeVenda } from "../features/marketing"; import { DRE, Planos } from "../features/finance"; import { Fiados } from "../features/fiados";
import type { Product, Customer, Seller, Sale, StockLocation, AdEntry, WaScheduleEntry, WelcomeConfig } from "../types";

function SupplementSystem() {   
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dark, setDark] = useState(true);   
    const [accent, setAccent] = useState("#DC2626");   
    const [device, setDevice] = useState("mobile");   
    const [tab, setTab] = useState("dashboard");    

    // 🔄 Estados inicializados verificando o localStorage (começam do zero se não houver dados salvos)
    const [products, setProducts] = useState(() => {
        const saved = localStorage.getItem("byse_products");
        return saved ? JSON.parse(saved) : [];
    });

    const [customers, setCustomers] = useState(() => {
        const saved = localStorage.getItem("byse_customers");
        return saved ? JSON.parse(saved) : [];
    });

    const [sellers, setSellers] = useState(() => {
        const saved = localStorage.getItem("byse_sellers");
        return saved ? JSON.parse(saved) : [];
    });

    const [sales, setSales] = useState(() => {
        const saved = localStorage.getItem("byse_sales");
        return saved ? JSON.parse(saved) : [];
    });

    const [fiados, setFiados] = useState(() => {
        const saved = localStorage.getItem("byse_fiados");
        return saved ? JSON.parse(saved) : [];
    });

    const [adEntries, setAdEntries] = useState(() => {
        const saved = localStorage.getItem("byse_adEntries");
        return saved ? JSON.parse(saved) : [];
    });

    const [stockLocations, setStockLocations] = useState(() => {
        const saved = localStorage.getItem("byse_stockLocations");
        return saved ? JSON.parse(saved) : [{ id: "loja", name: "Loja física" }, { id: "degustacao", name: "Degustação" }];
    });

    const [cashbackPct, setCashbackPct] = useState(3);   
    const [cashbackValidityDays, setCashbackValidityDays] = useState(90);   
    const [waSchedule, setWaSchedule] = useState([     { id: 1, label: "Lembrete de saldo cashback", day: "Toda sexta-feira", enabled: true, text: "Oi {nome}, você tem {saldo} em cashback esperando! 🎁" },     { id: 2, label: "Promoção do mês", day: "Dia 5 de cada mês", enabled: true, text: "Oi {nome}! Temos novidades e promoções especiais esse mês na loja. 💪" },     { id: 3, label: "Cliente sumido (30 dias sem comprar)", day: "Dia 15 de cada mês", enabled: false, text: "Sentimos sua falta, {nome}! Faz tempo que você não aparece por aqui." },   ]);    

    // 💾 Efeitos para salvar automaticamente no localStorage sempre que houver alterações
    useEffect(() => { localStorage.setItem("byse_products", JSON.stringify(products)); }, [products]);
    useEffect(() => { localStorage.setItem("byse_customers", JSON.stringify(customers)); }, [customers]);
    useEffect(() => { localStorage.setItem("byse_sellers", JSON.stringify(sellers)); }, [sellers]);
    useEffect(() => { localStorage.setItem("byse_sales", JSON.stringify(sales)); }, [sales]);
    useEffect(() => { localStorage.setItem("byse_fiados", JSON.stringify(fiados)); }, [fiados]);
    useEffect(() => { localStorage.setItem("byse_adEntries", JSON.stringify(adEntries)); }, [adEntries]);
    useEffect(() => { localStorage.setItem("byse_stockLocations", JSON.stringify(stockLocations)); }, [stockLocations]);

    // 🔍 Efeito para restaurar a sessão do localStorage ao carregar a página[cite: 15]
    useEffect(() => {
        const savedToken = localStorage.getItem("byse_token");
        const savedUser = localStorage.getItem("byse_user");

        if (savedToken && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (error) {
                console.error("Erro ao carregar sessão salva:", error);
                localStorage.removeItem("byse_token");
                localStorage.removeItem("byse_user");
            }
        }
        setLoading(false);
    }, []);

    // 🚪 Função para encerrar a sessão (Logout)[cite: 15]
    const handleLogout = () => {
        localStorage.removeItem("byse_token");
        localStorage.removeItem("byse_user");
        setUser(null);
    };

    const bg = dark ? "#0C0C0C" : "#F5F3EE";   
    const card = dark ? "#1C1C1C" : "#FFFFFF";   
    const card2 = dark ? "#141414" : "#FBFAF7";   
    const text = dark ? "#F0EFE9" : "#1A1A1A";   
    const subtext = dark ? "#8A8A82" : "#6E6B62";   
    const border = dark ? "#2E2E2E" : "#E7E2D8";    

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: text, fontFamily: FONT_BODY }}>
                Carregando...
            </div>
        );
    }

    if (!user) {
        return <LoginScreen accent={accent} onLogin={(userData) => setUser(userData)} />;
    }

    const nav = [     { id: "dashboard", label: "Painel", icon: BarChart3 },     { id: "clientes", label: "Clientes", icon: Users },     { id: "estoque", label: "Estoque", icon: Package },     { id: "pdv", label: "PDV", icon: ShoppingCart },     { id: "vendedores", label: "Vendedores", icon: Award },     { id: "catalogo", label: "Catálogo", icon: Store },     { id: "cashback", label: "Cashback", icon: Gift },     { id: "fiados", label: "Fiados", icon: Wallet },     { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },     { id: "trafego", label: "Tráfego Pago", icon: TrendingUp },     { id: "canais", label: "Canais de Venda", icon: Share2 },     { id: "dre", label: "DRE", icon: Calculator },     { id: "planos", label: "Planos", icon: Percent },   ];   
    const MOBILE_PRIMARY = ["dashboard", "pdv", "clientes", "estoque"];   
    const mobileBottomItems = nav.filter((n) => MOBILE_PRIMARY.includes(n.id));   
    const mobileMenuItems = nav.filter((n) => !MOBILE_PRIMARY.includes(n.id));    

    const renderScreen = () => {     
        if (tab === "dashboard") return <Dashboard {...{ sales, products, customers, sellers, card, border, subtext, accent, text }} />;     
        if (tab === "clientes") return <Clientes {...{ customers, setCustomers, sales, card, border, subtext, accent, text }} />;     
        if (tab === "estoque") return <Estoque {...{ products, setProducts, stockLocations, setStockLocations, card, border, subtext, accent, text }} />;     
        if (tab === "pdv") return <PDV {...{ device, products, customers, setCustomers, sellers, sales, setSales, fiados, setFiados, cashbackPct, card, border, subtext, accent, text, dark }} />;     
        if (tab === "vendedores") return <Vendedores {...{ sellers, setSellers, sales, card, border, subtext, accent, text }} />;     
        if (tab === "catalogo") return <Catalogo {...{ products, sales, card, border, subtext, accent, text, dark, device }} />;     
        if (tab === "cashback") return <Cashback {...{ customers, setCustomers, cashbackPct, setCashbackPct, cashbackValidityDays, setCashbackValidityDays, card, border, subtext, accent, text }} />;     
        if (tab === "fiados") return <Fiados {...{ fiados, setFiados, customers, card, border, subtext, accent, text }} />;     
        if (tab === "whatsapp") return <WhatsApp {...{ waSchedule, setWaSchedule, cashbackValidityDays, card, border, subtext, accent, text }} />;     
        if (tab === "trafego") return <TrafegoPago {...{ adEntries, setAdEntries, sales, card, border, subtext, accent, text }} />;     
        if (tab === "canais") return <CanaisDeVenda {...{ sales, setSales, card, border, subtext, accent, text }} />;     
        if (tab === "dre") return <DRE {...{ sales, card, border, subtext, accent, text }} />;     
        if (tab === "planos") return <Planos {...{ card, border, subtext, accent, text }} />;     
        if (tab === "menu") return <MenuGridScreen items={mobileMenuItems} onNavigate={setTab} card={card} border={border} subtext={subtext} accent={accent} text={text} />;     
        return null;   
    };    

    if (device === "mobile") {     
        return (       
            <div style={{ "--accent": accent, minHeight: "100vh", background: bg }}>         
                <style>{GLOBAL_CSS}</style>         
                <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", background: bg, color: text, fontFamily: FONT_BODY }}>           
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px 10px", background: card2, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>             
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>               
                            <LogoMark accent={accent} size={28} />               
                            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, letterSpacing: 2 }}>BYSE <span style={{ color: accent }}>PRO</span></span>             
                        </div>             
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>               
                            <button onClick={() => setDevice("desktop")} style={{ padding: "5px 10px", background: card, border: `1px solid ${border}`, borderRadius: 7, color: subtext, fontFamily: FONT_BODY, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>💻 Notebook</button>               
                            <button onClick={() => setDark(!dark)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: card, border: `1px solid ${border}`, borderRadius: 7, cursor: "pointer", color: text }}>                 
                                {dark ? <Sun size={13} /> : <Moon size={13} />}               
                            </button>             
                            <button onClick={handleLogout} title="Sair" style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: card, border: `1px solid ${border}`, borderRadius: 7, cursor: "pointer", color: "#FF5555" }}>                 
                                <LogOut size={13} />               
                            </button>             
                        </div>           
                    </div>           
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>             
                        {mobileMenuItems.some((i) => i.id === tab) && (               
                            <button onClick={() => setTab("menu")} style={{ background: "none", border: "none", color: subtext, fontSize: 12.5, marginBottom: 12, cursor: "pointer", padding: 0 }}>← Menu</button>             
                        )}             
                        {renderScreen()}           
                    </div>           
                    <div style={{ display: "flex", borderTop: `1px solid ${border}`, background: card2, flexShrink: 0 }}>             
                        {mobileBottomItems.map((n) => {               
                            const Icon = n.icon; const active = tab === n.id;               
                            return (                 
                                <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px 8px", border: "none", cursor: "pointer", background: active ? `${accent}18` : "transparent", borderTop: active ? `2px solid ${accent}` : "2px solid transparent" }}>                   
                                    <Icon size={17} color={active ? accent : subtext} />                   
                                    <span style={{ fontSize: 9.5, color: active ? accent : subtext, fontWeight: active ? 700 : 500 }}>{n.label}</span>                 
                                </button>               
                            );             
                        })}             
                        <button onClick={() => setTab("menu")} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "9px 4px 8px", border: "none", cursor: "pointer", background: tab === "menu" ? `${accent}18` : "transparent", borderTop: tab === "menu" ? `2px solid ${accent}` : "2px solid transparent" }}>               
                            <LayoutGrid size={17} color={tab === "menu" ? accent : subtext} />               
                            <span style={{ fontSize: 9.5, color: tab === "menu" ? accent : subtext, fontWeight: tab === "menu" ? 700 : 500 }}>Menu</span>             
                        </button>           
                    </div>         
                </div>       
            </div>     
        );   
    }    

    return (     
        <div style={{ "--accent": accent, minHeight: "100vh", background: bg, color: text, fontFamily: FONT_BODY }}>       
            <style>{GLOBAL_CSS}</style>       
            <div style={{ display: "flex" }}>         
                <div style={{ width: 224, minHeight: "100vh", background: card2, borderRight: `1px solid ${border}`, padding: "20px 12px", position: "sticky", top: 0, overflowY: "auto" }}>           
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px", borderBottom: `1px solid ${border}`, marginBottom: 16 }}>             
                        <LogoMark accent={accent} size={34} />             
                        <div>               
                            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, letterSpacing: 1.5 }}>BYSE <span style={{ color: accent }}>PRO</span></div>               
                            <div style={{ fontSize: 10.5, color: subtext }}>{user?.name || user?.email || "MVP · protótipo"}</div>             
                        </div>           
                    </div>           
                    {nav.map((n) => {             
                        const Icon = n.icon; const active = tab === n.id;             
                        return (               
                            <button key={n.id} onClick={() => setTab(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", marginBottom: 3, borderRadius: 8, border: "none", background: active ? accent : "transparent", color: active ? "#fff" : text, fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", textAlign: "left" }}>                 
                                <Icon size={15} /> {n.label}               
                            </button>             
                        );           
                    })}           
                    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${border}` }}>             
                        <SLabel subtext={subtext}>Aparência & Conta</SLabel>             
                        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>               
                            <button onClick={() => setDevice("mobile")} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>📱 Celular</button>               
                            <button onClick={() => setDevice("desktop")} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `1px solid ${accent}`, background: accent, color: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>💻 Notebook</button>             
                        </div>             
                        <button onClick={() => setDark(!dark)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>               
                            {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? "Modo dia" : "Modo noite"}             
                        </button>             
                        <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: "#FF5555", fontSize: 13, cursor: "pointer", marginBottom: 12 }}>               
                            <LogOut size={15} /> Sair do sistema             
                        </button>             
                        <div style={{ display: "flex", gap: 6, paddingLeft: 8 }}>               
                            {PRESET_COLORS.map((c) => (<button key={c} onClick={() => setAccent(c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: accent === c ? `2px solid ${text}` : "1px solid transparent", cursor: "pointer" }} />))}             
                        </div>           
                    </div>         
                </div>         
                <div style={{ flex: 1, padding: "28px 32px", maxWidth: 1100 }}>{renderScreen()}</div>       
            </div>     
        </div>   
    ); 
}

export default SupplementSystem;