// @ts-nocheck
import React, { useEffect, useState } from "react";
import { FONT_BODY, FONT_DISPLAY } from "../data/constants";

export function PublicCatalog() {
    const [storeData, setStoreData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Extrai o ID do usuário da URL: /catalogo/1787335620584
        const path = window.location.pathname;
        const match = path.match(/^\/catalogo\/([^/]+)$/);

        if (!match) {
            setError(true);
            setLoading(false);
            return;
        }

        const storeUserId = match[1];

        // Define a URL da API da mesma forma que o resto do sistema
        const getApiUrl = () => {
            if (import.meta.env.VITE_API_URL) {
                const raw = import.meta.env.VITE_API_URL;
                return raw.endsWith('/api') ? raw : `${raw.endsWith('/') ? raw.slice(0, -1) : raw}/api`;
            }
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return 'http://localhost:3333/api';
            }
            return 'https://byse-pro-finale-production.up.railway.app/api';
        };

        fetch(`${getApiUrl()}/public/catalogo/${storeUserId}`)
            .then(res => {
                if (!res.ok) throw new Error("Loja não encontrada");
                return res.json();
            })
            .then(data => {
                setStoreData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Erro ao carregar catálogo:", err);
                setError(true);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "#0C0C0C", color: "#F0EFE9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
                Carregando catálogo...
            </div>
        );
    }

    if (error || !storeData) {
        return (
            <div style={{ minHeight: "100vh", background: "#0C0C0C", color: "#F0EFE9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 20 }}>
                <h2 style={{ color: "#DC2626", marginBottom: 8 }}>Catálogo não encontrado</h2>
                <p style={{ color: "#8A8A82" }}>Verifique se o link está correto ou se a loja possui produtos cadastrados.</p>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#0C0C0C", color: "#F0EFE9", padding: "24px 16px", fontFamily: "sans-serif" }}>
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
                <h1 style={{ textAlign: "center", marginBottom: 6, fontSize: 24 }}>{storeData.storeName || "Catálogo da Loja"}</h1>
                <p style={{ textAlign: "center", color: "#8A8A82", marginBottom: 28, fontSize: 14 }}>Confira nossos produtos disponíveis:</p>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                    {storeData.products?.map((p: any) => (
                        <div key={p.id} style={{ background: "#1C1C1C", border: "1px solid #2E2E2E", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                            <div>
                                {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} />}
                                <h3 style={{ fontSize: 16, marginBottom: 6, color: "#fff" }}>{p.name}</h3>
                                <p style={{ fontSize: 13, color: "#8A8A82", marginBottom: 12 }}>{p.category}</p>
                            </div>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: "bold", color: "#DC2626", marginBottom: 12 }}>
                                    R$ {Number(p.price).toFixed(2)}
                                </div>
                                <a 
                                    href={`https://wa.me/?text=${encodeURIComponent(`Olá! Tenho interesse no produto: ${p.name} por R$ ${Number(p.price).toFixed(2)}`)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{ display: "block", textAlign: "center", background: "#25D366", color: "#fff", padding: "10px", borderRadius: 8, textDecoration: "none", fontWeight: "bold", fontSize: 13 }}
                                >
                                    Comprar via WhatsApp
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}