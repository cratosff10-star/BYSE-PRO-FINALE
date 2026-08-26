// @ts-nocheck
import React, { useState } from "react";
import { Save, User, Mail, Smartphone, CreditCard } from "lucide-react";
import { inputStyle, lbl } from "../utils/helpers";

export function CustomerRegistration({ onSave, onCancel, card, border, text, subtext, accent }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!form.name || !form.phone) {
      alert("Nome e Telefone são obrigatórios!");
      return;
    }
    onSave(form);
  };

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 20 }}>
      <h3 style={{ fontFamily: "inherit", fontSize: 18, marginBottom: 16, color: text }}>Novo Cadastro de Cliente</h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* NOME */}
        <div>
          <label style={lbl(subtext)}>NOME COMPLETO</label>
          <div style={{ position: "relative" }}>
            <User size={16} style={{ position: "absolute", left: 10, top: 10, color: subtext }} />
            <input 
              name="name" value={form.name} onChange={handleChange}
              placeholder="Ex: João Silva"
              style={{ ...inputStyle(border, text), paddingLeft: 35, width: "100%" }} 
            />
          </div>
        </div>

        {/* CPF */}
        <div>
          <label style={lbl(subtext)}>CPF</label>
          <div style={{ position: "relative" }}>
            <CreditCard size={16} style={{ position: "absolute", left: 10, top: 10, color: subtext }} />
            <input 
              name="cpf" value={form.cpf} onChange={handleChange}
              placeholder="000.000.000-00"
              style={{ ...inputStyle(border, text), paddingLeft: 35, width: "100%" }} 
            />
          </div>
        </div>

        {/* EMAIL */}
        <div>
          <label style={lbl(subtext)}>E-MAIL</label>
          <div style={{ position: "relative" }}>
            <Mail size={16} style={{ position: "absolute", left: 10, top: 10, color: subtext }} />
            <input 
              name="email" value={form.email} onChange={handleChange}
              placeholder="email@exemplo.com"
              style={{ ...inputStyle(border, text), paddingLeft: 35, width: "100%" }} 
            />
          </div>
        </div>

        {/* TELEFONE */}
        <div>
          <label style={lbl(subtext)}>TELEFONE</label>
          <div style={{ position: "relative" }}>
            <Smartphone size={16} style={{ position: "absolute", left: 10, top: 10, color: subtext }} />
            <input 
              name="phone" value={form.phone} onChange={handleChange}
              placeholder="(00) 00000-0000"
              style={{ ...inputStyle(border, text), paddingLeft: 35, width: "100%" }} 
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button 
          onClick={handleSave}
          style={{ background: accent, border: "none", color: "#fff", padding: "10px 20px", borderRadius: 8, cursor: "pointer", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Save size={16} /> Salvar Cliente
        </button>
        {onCancel && (
          <button 
            onClick={onCancel}
            style={{ background: "transparent", border: `1px solid ${border}`, color: text, padding: "10px 20px", borderRadius: 8, cursor: "pointer" }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}