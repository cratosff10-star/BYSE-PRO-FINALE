import React, { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Play, Save, Settings2, Users, Clock } from "lucide-react";
import { SectionTitle, Pill, SLabel } from "../components/common";
import { reminderApi, type ReminderSettings } from "../services/reminderApi";

export function WhatsApp({ card, border, subtext, accent, text }: any) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void Promise.all([reminderApi.getSettings(), reminderApi.stats()]).then(([s, st]) => { setSettings(s); setMessage(s.template); setStats(st); }).catch(() => setStatus("Servidor do bot não conectado. Inicie npm run server."));
  }, []);

  if (!settings) return <div style={{ color: subtext, padding: 20 }}>{status || "Carregando configuração do bot..."}</div>;

  const save = async () => {
    try { await reminderApi.saveSettings({ enabled: settings.enabled, first_day: settings.first_day, second_day: settings.second_day, hour: settings.hour, minute: settings.minute, template: message }); setStatus("Configuração salva."); }
    catch { setStatus("Não foi possível salvar. Verifique o servidor."); }
  };

  const runNow = async () => {
    setRunning(true); setStatus("Executando envio...");
    try { const result = await reminderApi.runNow(); setStatus(`Envio concluído: ${result.sent} enviados, ${result.failed} falharam.`); setStats(await reminderApi.stats()); }
    catch { setStatus("Falha ao executar o lote."); }
    finally { setRunning(false); }
  };

  return <div>
    <SectionTitle title="Bot de lembretes WhatsApp" sub="Automação de pós-compra — duas vezes por semana" subtext={subtext} />
    <div style={{ background: `${accent}12`, border: `1px solid ${accent}40`, borderRadius: 12, padding: 14, marginBottom: 16, color: text }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}><MessageCircle size={18} /> Bot ativo para clientes que fizeram compra e autorizaram WhatsApp</div>
      <div style={{ fontSize: 12, color: subtext, marginTop: 6 }}>Por padrão, o envio acontece às <b>terças e sextas às 10:00</b>, no horário de Brasília. O sistema não repete o mesmo lembrete no mesmo dia.</div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
      {[['Clientes alcançados', stats.total, Users], ['Mensagens enviadas', stats.sent, CheckCircle2], ['Falhas', stats.failed, Settings2]].map(([label, value, Icon]: any) => <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 14 }}><Icon size={16} color={accent}/><div style={{ fontSize: 22, fontWeight: 800, marginTop: 5 }}>{value}</div><div style={{ fontSize: 11, color: subtext }}>{label}</div></div>)}
    </div>

    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}><div><div style={{ fontWeight: 700 }}>Programação</div><div style={{ fontSize: 11, color: subtext }}>Dois disparos semanais</div></div><Pill color={settings.enabled ? "#4CAF7D" : subtext}>{settings.enabled ? "Ativo" : "Pausado"}</Pill></div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 12 }}><input type="checkbox" checked={!!settings.enabled} onChange={e => setSettings({...settings, enabled: e.target.checked ? 1 : 0})}/><span>Ativar bot de lembretes</span></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10 }}>
        <div><SLabel subtext={subtext}>1º DIA</SLabel><select value={settings.first_day} onChange={e=>setSettings({...settings, first_day:e.target.value})} style={{ width:"100%", padding:9, background:"transparent", color:text, border:`1px solid ${border}`, borderRadius:7 }}><option value="tuesday">Terça-feira</option><option value="wednesday">Quarta-feira</option><option value="thursday">Quinta-feira</option></select></div>
        <div><SLabel subtext={subtext}>2º DIA</SLabel><select value={settings.second_day} onChange={e=>setSettings({...settings, second_day:e.target.value})} style={{ width:"100%", padding:9, background:"transparent", color:text, border:`1px solid ${border}`, borderRadius:7 }}><option value="friday">Sexta-feira</option><option value="saturday">Sábado</option><option value="sunday">Domingo</option></select></div>
        <div><SLabel subtext={subtext}>HORÁRIO</SLabel><input type="time" value={`${String(settings.hour).padStart(2,'0')}:${String(settings.minute).padStart(2,'0')}`} onChange={e=>{const [h,m]=e.target.value.split(':').map(Number);setSettings({...settings,hour:h,minute:m})}} style={{ width:"100%", padding:9, background:"transparent", color:text, border:`1px solid ${border}`, borderRadius:7 }}/></div>
      </div>
      <div style={{ marginTop: 16 }}><SLabel subtext={subtext}>MENSAGEM</SLabel><textarea rows={7} value={message} onChange={e=>setMessage(e.target.value)} style={{ width:"100%", marginTop:5, padding:10, background:"transparent", color:text, border:`1px solid ${border}`, borderRadius:8, resize:"vertical" }}/><div style={{fontSize:10.5,color:subtext,marginTop:5}}>Variáveis: {'{nome}'} · {'{produtos}'} · {'{total}'}</div></div>
      <div style={{ display:"flex", gap:8, marginTop:14 }}><button onClick={save} style={{ background:accent,color:'#fff',border:'none',borderRadius:8,padding:'9px 14px',fontWeight:700,cursor:'pointer' }}><Save size={14} style={{verticalAlign:'middle',marginRight:5}}/>Salvar</button><button onClick={runNow} disabled={running} style={{ background:'transparent',color:text,border:`1px solid ${border}`,borderRadius:8,padding:'9px 14px',fontWeight:700,cursor:'pointer' }}><Play size={14} style={{verticalAlign:'middle',marginRight:5}}/>{running?'Enviando...':'Testar agora'}</button></div>
      {status && <div style={{ marginTop:10, fontSize:11.5, color:subtext }}><Clock size={13} style={{verticalAlign:'middle',marginRight:4}}/>{status}</div>}
    </div>
  </div>;
}
