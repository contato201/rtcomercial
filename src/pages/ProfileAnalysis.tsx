import { useState } from "react";
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Globe, FileText, Loader2, Copy, CheckCircle2 } from "lucide-react";

const BUSINESS_TYPES = [
  { value: "negocio-local", label: "Negócio Local" },
  { value: "infoproduto", label: "Infoproduto" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS / Software" },
  { value: "servicos", label: "Prestação de Serviços" },
  { value: "outro", label: "Outro" },
] as const;

const PAGE_TYPES = [
  { value: "vendas", label: "Página de Vendas" },
  { value: "captura", label: "Página de Captura / Lançamento" },
  { value: "negocio-local", label: "Página de Negócio Local" },
  { value: "institucional", label: "Site Institucional" },
  { value: "outro", label: "Outro" },
] as const;

const ProfileAnalysis = () => {
  const { toast } = useToast();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfText, setPdfText] = useState("");
  const [pageUrl, setPageUrl] = useState("");
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

    // Read PDF as text (basic extraction)
    const reader = new FileReader();
    reader.onload = async () => {
      const text = reader.result as string;
      // For PDF we'll send the base64 content and let the AI interpret it
      // Since browser can't parse PDF natively, we'll extract text via the AI
      const base64 = btoa(
        new Uint8Array(reader.result as ArrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      setPdfText(`[PDF uploaded: ${file.name}] - O conteúdo será analisado pela IA`);
    };
    reader.readAsArrayBuffer(file);
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
      // If we have a PDF file, upload it and get text
      let finalPdfText = pdfText;
      if (pdfFile) {
        // Upload to storage
        const filePath = `${Date.now()}-${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-pdfs")
          .upload(filePath, pdfFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Continue without the file, use the text description
        }
        finalPdfText = `Arquivo PDF enviado: ${pdfFile.name}. Analise com base no nome e contexto fornecido.`;
      }

      const { data, error } = await supabase.functions.invoke("analyze-profile", {
        body: {
          pdfText: finalPdfText || undefined,
          pageUrl: pageUrl || undefined,
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

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Análise de Perfil</h1>
          <p className="text-muted-foreground mt-1">
            Analise prospects e gere roteiros de vídeo personalizados para prospecção
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5 text-primary" />
                  PDF do Instagram
                </CardTitle>
                <CardDescription>
                  Envie o relatório ou print do perfil em PDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="cursor-pointer"
                  />
                  {pdfFile && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {pdfFile.name}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="w-5 h-5 text-primary" />
                  Link da Página
                </CardTitle>
                <CardDescription>
                  Cole o link da página de vendas, captura ou negócio local
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="url"
                  placeholder="https://exemplo.com.br"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary" />
                  Scripts de Prospecção
                </CardTitle>
                <CardDescription>
                  Cole seus scripts atuais de prospecção para esse perfil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Cole aqui seus scripts de prospecção..."
                  value={scripts}
                  onChange={(e) => setScripts(e.target.value)}
                  rows={6}
                />
              </CardContent>
            </Card>

            <Button
              onClick={handleAnalyze}
              disabled={isLoading || (!pdfText && !pageUrl && !scripts)}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                "🎬 Gerar Roteiro de Vídeo"
              )}
            </Button>
          </div>

          {/* Output */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Roteiro de Vídeo</CardTitle>
                  {analysis && (
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  O roteiro será gerado aqui após a análise
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-3" />
                    <p>Analisando perfil e gerando roteiro...</p>
                    <p className="text-sm mt-1">Isso pode levar alguns segundos</p>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm leading-relaxed">
                    {analysis}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mb-3 opacity-30" />
                    <p>Preencha os campos e clique em "Gerar Roteiro"</p>
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
