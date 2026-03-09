import { useState, useRef } from "react";
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  Globe,
  FileText,
  Loader2,
  Copy,
  CheckCircle2,
  X,
  Sparkles,
  Store,
  ShoppingBag,
  Monitor,
  Briefcase,
  Package,
  HelpCircle,
  ExternalLink,
  Target,
  Megaphone,
  Building2,
  LayoutTemplate,
} from "lucide-react";

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

const ProfileAnalysis = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [pageType, setPageType] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [scripts, setScripts] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Erro", description: "Envie um arquivo PDF", variant: "destructive" });
      return;
    }

    setPdfFile(file);
    const reader = new FileReader();
    reader.onload = async () => {
      setPdfText(`[PDF uploaded: ${file.name}]`);
    };
    reader.readAsArrayBuffer(file);
  };

  const removePdf = () => {
    setPdfFile(null);
    setPdfText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!pdfText && !pageUrl && !scripts) {
      toast({
        title: "Atenção",
        description: "Preencha pelo menos um campo para análise",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAnalysis("");

    try {
      let finalPdfText = pdfText;
      if (pdfFile) {
        const filePath = `${Date.now()}-${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-pdfs")
          .upload(filePath, pdfFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        }
        finalPdfText = `Arquivo PDF enviado: ${pdfFile.name}. Analise com base no nome e contexto fornecido.`;
      }

      const { data, error } = await supabase.functions.invoke("analyze-profile", {
        body: {
          pdfText: finalPdfText || undefined,
          pageUrl: pageUrl || undefined,
          pageType: pageType || undefined,
          businessType: businessType || undefined,
          scripts: scripts || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        setAnalysis(data.analysis);
        toast({ title: "Análise concluída!", description: "Roteiro de vídeo gerado com sucesso" });
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível gerar a análise",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    toast({ title: "Copiado!", description: "Roteiro copiado para a área de transferência" });
    setTimeout(() => setCopied(false), 2000);
  };

  const filledCount = [pdfText, pageUrl, scripts].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Análise de Perfil</h1>
              <p className="text-sm text-muted-foreground">
                Analise prospects e gere roteiros de vídeo personalizados
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ───── LEFT: FORM ───── */}
          <div className="space-y-6">

            {/* Tipo de Negócio — Card Grid */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Tipo de Negócio
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {BUSINESS_TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = businessType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setBusinessType(selected ? "" : t.value)}
                      className={`group relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3.5 text-center transition-all duration-200 cursor-pointer
                        ${selected
                          ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent/40"
                        }`}
                    >
                      <Icon className={`w-5 h-5 transition-colors ${selected ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`} />
                      <span className={`text-xs font-semibold leading-tight ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                        {t.label}
                      </span>
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {businessType && (
                <p className="text-xs text-muted-foreground pl-1">
                  {BUSINESS_TYPES.find((t) => t.value === businessType)?.description}
                </p>
              )}
            </section>

            {/* PDF Upload — Drop Zone */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                PDF do Instagram
              </h2>

              {!pdfFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card hover:bg-accent/30 transition-all duration-200 p-8 flex flex-col items-center gap-3 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Clique para enviar o PDF</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Relatório ou print do perfil Instagram</p>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{pdfFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(pdfFile.size / 1024).toFixed(0)} KB • PDF</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removePdf}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
            </section>

            {/* Link da Página + Tipo */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                Link da Página
              </h2>

              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="https://exemplo.com.br"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Page type chips */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tipo da página:</p>
                  <div className="flex flex-wrap gap-2">
                    {PAGE_TYPES.map((t) => {
                      const Icon = t.icon;
                      const selected = pageType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setPageType(selected ? "" : t.value)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer
                            ${selected
                              ? "border-primary bg-primary/10 text-foreground shadow-sm"
                              : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {pageType && (
                  <p className="text-xs text-muted-foreground">
                    {PAGE_TYPES.find((t) => t.value === pageType)?.description}
                  </p>
                )}
              </div>
            </section>

            {/* Scripts */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Scripts de Prospecção
              </h2>
              <div className="rounded-xl border border-border bg-card p-4">
                <Textarea
                  placeholder="Cole aqui seus scripts de prospecção para esse perfil..."
                  value={scripts}
                  onChange={(e) => setScripts(e.target.value)}
                  rows={5}
                  className="border-0 bg-transparent p-0 focus-visible:ring-0 resize-none text-sm"
                />
              </div>
            </section>

            {/* Submit */}
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || (!pdfText && !pageUrl && !scripts)}
              className="w-full h-12 text-base font-semibold gap-2 rounded-xl shadow-md hover:shadow-lg transition-shadow"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Gerar Roteiro de Vídeo
                </>
              )}
            </Button>

            {filledCount > 0 && !isLoading && (
              <p className="text-xs text-center text-muted-foreground">
                {filledCount} {filledCount === 1 ? "entrada preenchida" : "entradas preenchidas"}
                {businessType && ` • ${BUSINESS_TYPES.find(t => t.value === businessType)?.label}`}
                {pageType && ` • ${PAGE_TYPES.find(t => t.value === pageType)?.label}`}
              </p>
            )}
          </div>

          {/* ───── RIGHT: OUTPUT ───── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="overflow-hidden border-2">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="text-sm font-semibold text-foreground">Roteiro de Vídeo</h3>
                </div>
                {analysis && (
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5 rounded-lg">
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                )}
              </div>
              <CardContent className="p-5">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-muted animate-pulse" />
                      <Loader2 className="w-8 h-8 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground">Gerando roteiro...</p>
                      <p className="text-xs mt-1">Analisando perfil e criando recomendações</p>
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
                    {analysis}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 opacity-30" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-foreground/60">Nenhum roteiro gerado</p>
                      <p className="text-xs mt-0.5">Preencha os campos ao lado e clique em gerar</p>
                    </div>
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
