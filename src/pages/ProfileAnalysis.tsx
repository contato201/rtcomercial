import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Upload, Globe, FileText, Loader2, Copy, CheckCircle2, X, Sparkles,
  Store, ShoppingBag, Monitor, Briefcase, Package, HelpCircle, ExternalLink,
  Target, Megaphone, Building2, LayoutTemplate, Clock, Trash2, Eye, User,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BUSINESS_TYPES = [
  { value: "negocio-local", label: "Negócio Local", icon: Store, description: "Restaurante, clínica, salão, loja física..." },
  { value: "infoproduto", label: "Infoproduto", icon: Megaphone, description: "Curso online, mentoria, e-book, comunidade..." },
  { value: "ecommerce", label: "E-commerce", icon: ShoppingBag, description: "Loja virtual, dropshipping, marketplace..." },
  { value: "saas", label: "SaaS / Software", icon: Monitor, description: "Aplicativo, plataforma, ferramenta digital..." },
  { value: "servicos", label: "Serviços", icon: Briefcase, description: "Agência, consultoria, freelancer..." },
  { value: "outro", label: "Outro", icon: HelpCircle, description: "Outro tipo de negócio" },
] as const;

const PAGE_TYPES = [
  { value: "vendas", label: "Página de Vendas", icon: Target, description: "Oferta de produto/serviço com CTA de compra" },
  { value: "captura", label: "Captura / Lançamento", icon: Megaphone, description: "Captação de leads, webinário, lançamento" },
  { value: "negocio-local", label: "Negócio Local", icon: Building2, description: "Site do estabelecimento com endereço e contato" },
  { value: "institucional", label: "Site Institucional", icon: LayoutTemplate, description: "Site corporativo, portfólio, apresentação" },
  { value: "outro", label: "Outro", icon: HelpCircle, description: "Outro tipo de página" },
] as const;

interface AnalysisHistory {
  id: string;
  business_type: string | null;
  page_type: string | null;
  page_url: string | null;
  pdf_name: string | null;
  prospect_name: string | null;
  analysis: string;
  created_at: string;
}

const ProfileAnalysis = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [pageType, setPageType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [scripts, setScripts] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // History
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingAnalysis, setViewingAnalysis] = useState<AnalysisHistory | null>(null);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("analises_perfil")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data as AnalysisHistory[]) || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const saveAnalysis = async (analysisText: string) => {
    if (!user) return;
    try {
      await supabase.from("analises_perfil").insert({
        user_id: user.id,
        business_type: businessType || null,
        page_type: pageType || null,
        page_url: pageUrl || null,
        pdf_name: pdfFile?.name || null,
        prospect_name: prospectName || null,
        scripts: scripts || null,
        analysis: analysisText,
      });
      fetchHistory();
    } catch (err) {
      console.error("Error saving analysis:", err);
    }
  };

  const deleteAnalysis = async (id: string) => {
    try {
      await supabase.from("analises_perfil").delete().eq("id", id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      if (viewingAnalysis?.id === id) setViewingAnalysis(null);
      toast({ title: "Análise excluída" });
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Erro", description: "Envie um arquivo PDF", variant: "destructive" });
      return;
    }
    setPdfFile(file);
    setPdfText(`[PDF uploaded: ${file.name}]`);
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!pdfText && !pageUrl && !scripts) {
      toast({ title: "Atenção", description: "Preencha pelo menos um campo para análise", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setAnalysis("");
    setViewingAnalysis(null);

    try {
      let finalPdfText = pdfText;
      if (pdfFile) {
        const filePath = `${Date.now()}-${pdfFile.name}`;
        await supabase.storage.from("profile-pdfs").upload(filePath, pdfFile);
        finalPdfText = `Arquivo PDF enviado: ${pdfFile.name}. Analise com base no nome e contexto fornecido.`;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || supabaseKey}`,
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          pdfText: finalPdfText || undefined,
          pageUrl: pageUrl || undefined,
          pageType: pageType || undefined,
          businessType: businessType || undefined,
          prospectName: prospectName || undefined,
          scripts: scripts || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Erro ao processar análise (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Streaming não suportado");

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setAnalysis(fullText);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (fullText) {
        await saveAnalysis(fullText);
        toast({ title: "Análise concluída!", description: "Relatório consultivo gerado com sucesso" });
      } else {
        toast({ title: "Erro", description: "Resposta vazia do servidor. Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast({
        title: "Erro na análise",
        description: err.message || "Não foi possível gerar a análise. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text?: string) => {
    navigator.clipboard.writeText(text || analysis);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedAnalysis = viewingAnalysis?.analysis || analysis;
  const filledCount = [pdfText, pageUrl, scripts].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Análise de Perfil</h1>
              <p className="text-sm text-muted-foreground">Análise consultiva profunda para prospecção</p>
            </div>
          </div>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <Clock className="w-4 h-4" />
              Histórico ({history.length})
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          )}
        </div>

        {/* History Panel */}
        {showHistory && (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Análises Anteriores
              </h3>
              {loadingHistory ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma análise salva ainda.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                        viewingAnalysis?.id === item.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => {
                          setViewingAnalysis(item);
                          setShowHistory(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.prospect_name || "Prospect sem nome"}
                          </span>
                          {item.business_type && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                              {BUSINESS_TYPES.find((t) => t.value === item.business_type)?.label || item.business_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          {item.page_url && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              • {item.page_url}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingAnalysis(item);
                            setShowHistory(false);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnalysis(item.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ───── LEFT: FORM (2 cols) ───── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Nome do Prospect */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-primary" />
                Nome do Prospect
              </h2>
              <Input
                placeholder="Ex: João da Clínica Viva"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
              />
            </section>

            {/* Tipo de Negócio */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-primary" />
                Tipo de Negócio
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BUSINESS_TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = businessType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setBusinessType(selected ? "" : t.value)}
                      className={`group relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all duration-200 cursor-pointer
                        ${selected
                          ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                        }`}
                    >
                      <Icon className={`w-4 h-4 transition-colors ${selected ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`} />
                      <span className={`text-[11px] font-semibold leading-tight ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.label}
                      </span>
                      {selected && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-2.5 h-2.5 text-primary-foreground" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {businessType && (
                <p className="text-[11px] text-muted-foreground pl-1">
                  {BUSINESS_TYPES.find((t) => t.value === businessType)?.description}
                </p>
              )}
            </section>

            {/* PDF Upload */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-primary" />
                PDF do Instagram
              </h2>
              {!pdfFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card hover:bg-accent/30 transition-all duration-200 p-6 flex flex-col items-center gap-2 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Upload className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground">Clique para enviar o PDF</p>
                    <p className="text-[11px] text-muted-foreground">Relatório ou print do perfil</p>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{pdfFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removePdf}
                    className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
            </section>

            {/* Link + Page Type */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-primary" />
                Link da Página
              </h2>
              <div className="rounded-xl border border-border bg-card p-3 space-y-3">
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="https://exemplo.com.br"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Tipo da página:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PAGE_TYPES.map((t) => {
                      const Icon = t.icon;
                      const selected = pageType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setPageType(selected ? "" : t.value)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200 cursor-pointer
                            ${selected
                              ? "border-primary bg-primary/10 text-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                        >
                          <Icon className="w-3 h-3" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Scripts */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Scripts de Prospecção
              </h2>
              <div className="rounded-xl border border-border bg-card p-3">
                <Textarea
                  placeholder="Cole aqui seus scripts de prospecção..."
                  value={scripts}
                  onChange={(e) => setScripts(e.target.value)}
                  rows={4}
                  className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
                />
              </div>
            </section>

            {/* Submit */}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || (!pdfText && !pageUrl && !scripts)}
              className="w-full h-11 text-sm font-semibold gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Análise Consultiva
                </>
              )}
            </Button>

            {filledCount > 0 && !isLoading && (
              <p className="text-[11px] text-center text-muted-foreground">
                {filledCount} {filledCount === 1 ? "entrada" : "entradas"}
                {prospectName && ` • ${prospectName}`}
                {businessType && ` • ${BUSINESS_TYPES.find((t) => t.value === businessType)?.label}`}
                {pageType && ` • ${PAGE_TYPES.find((t) => t.value === pageType)?.label}`}
              </p>
            )}
          </div>

          {/* ───── RIGHT: OUTPUT (3 cols) ───── */}
          <div className="lg:col-span-3 lg:sticky lg:top-4 lg:self-start">
            <Card className="overflow-hidden border-2">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isLoading ? "bg-amber-500 animate-pulse" : displayedAnalysis ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                  <h3 className="text-sm font-semibold text-foreground">
                    {viewingAnalysis
                      ? `Análise: ${viewingAnalysis.prospect_name || "Sem nome"}`
                      : "Resultado da Análise"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {viewingAnalysis && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingAnalysis(null)}
                      className="h-7 text-xs gap-1"
                    >
                      <X className="w-3 h-3" /> Fechar
                    </Button>
                  )}
                  {displayedAnalysis && (
                    <Button variant="outline" size="sm" onClick={() => handleCopy(displayedAnalysis)} className="h-7 text-xs gap-1 rounded-lg">
                      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </Button>
                  )}
                </div>
              </div>
              <CardContent className="p-0">
                {isLoading && !analysis ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 animate-pulse" />
                      <Loader2 className="w-8 h-8 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-medium text-foreground">Conectando com a IA...</p>
                      <p className="text-xs">A análise aparecerá em tempo real</p>
                    </div>
                  </div>
                ) : displayedAnalysis ? (
                  <div className="p-5 max-h-[75vh] overflow-y-auto">
                    <div className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed
                      prose-headings:text-foreground prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2
                      prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1
                      prose-strong:text-foreground prose-li:text-foreground/90
                      prose-table:border-collapse prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-1.5 prose-th:bg-muted/50
                      prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5
                      prose-hr:border-border">
                      <ReactMarkdown>{displayedAnalysis}</ReactMarkdown>
                      {isLoading && (
                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle rounded-sm" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 opacity-30" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground/60">Nenhuma análise gerada</p>
                      <p className="text-xs mt-0.5">Preencha os campos e clique em gerar</p>
                    </div>
                    {history.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5 text-xs"
                        onClick={() => setShowHistory(true)}
                      >
                        <Clock className="w-3 h-3" />
                        Ver análises anteriores
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileAnalysis;
