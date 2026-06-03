export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string
          data_lancamento: string
          id: string
          month: string
          pessoa: string
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_lancamento?: string
          id?: string
          month: string
          pessoa: string
          quantidade?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_lancamento?: string
          id?: string
          month?: string
          pessoa?: string
          quantidade?: number
          updated_at?: string
        }
        Relationships: []
      }
      analises_perfil: {
        Row: {
          analysis: string
          business_type: string | null
          created_at: string
          id: string
          page_type: string | null
          page_url: string | null
          pdf_name: string | null
          prospect_name: string | null
          scripts: string | null
          user_id: string | null
        }
        Insert: {
          analysis: string
          business_type?: string | null
          created_at?: string
          id?: string
          page_type?: string | null
          page_url?: string | null
          pdf_name?: string | null
          prospect_name?: string | null
          scripts?: string | null
          user_id?: string | null
        }
        Update: {
          analysis?: string
          business_type?: string | null
          created_at?: string
          id?: string
          page_type?: string | null
          page_url?: string | null
          pdf_name?: string | null
          prospect_name?: string | null
          scripts?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      dados_realizados: {
        Row: {
          created_at: string
          id: string
          month: string
          realizado_faturamento: number
          realizado_primeira_reuniao: number
          realizado_segunda_reuniao: number
          realizado_vendas: number
          ticket_realizado: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          realizado_faturamento?: number
          realizado_primeira_reuniao?: number
          realizado_segunda_reuniao?: number
          realizado_vendas?: number
          ticket_realizado?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          realizado_faturamento?: number
          realizado_primeira_reuniao?: number
          realizado_segunda_reuniao?: number
          realizado_vendas?: number
          ticket_realizado?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      dados_trafego: {
        Row: {
          cliques: number
          cpc: number
          created_at: string
          id: string
          impressoes: number
          investimento: number
          leads_qualificados: number
          leads_total: number
          month: string
          reunioes_agendadas: number
          updated_at: string
          valor_vendas: number
          vendas_fechadas: number
        }
        Insert: {
          cliques?: number
          cpc?: number
          created_at?: string
          id?: string
          impressoes?: number
          investimento?: number
          leads_qualificados?: number
          leads_total?: number
          month: string
          reunioes_agendadas?: number
          updated_at?: string
          valor_vendas?: number
          vendas_fechadas?: number
        }
        Update: {
          cliques?: number
          cpc?: number
          created_at?: string
          id?: string
          impressoes?: number
          investimento?: number
          leads_qualificados?: number
          leads_total?: number
          month?: string
          reunioes_agendadas?: number
          updated_at?: string
          valor_vendas?: number
          vendas_fechadas?: number
        }
        Relationships: []
      }
      historico_alteracoes: {
        Row: {
          campo_alterado: string
          created_at: string
          dados_realizados_id: string
          id: string
          month: string
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          campo_alterado: string
          created_at?: string
          dados_realizados_id: string
          id?: string
          month: string
          valor_anterior?: number
          valor_novo?: number
        }
        Update: {
          campo_alterado?: string
          created_at?: string
          dados_realizados_id?: string
          id?: string
          month?: string
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "historico_alteracoes_dados_realizados_id_fkey"
            columns: ["dados_realizados_id"]
            isOneToOne: false
            referencedRelation: "dados_realizados"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes_entries: {
        Row: {
          created_at: string
          data_lancamento: string
          id: string
          lead_nome: string | null
          month: string
          origem: string | null
          pessoa: string
          quantidade: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_lancamento?: string
          id?: string
          lead_nome?: string | null
          month: string
          origem?: string | null
          pessoa?: string
          quantidade?: number
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_lancamento?: string
          id?: string
          lead_nome?: string | null
          month?: string
          origem?: string | null
          pessoa?: string
          quantidade?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendas_unitarias: {
        Row: {
          cliente: string
          created_at: string
          id: string
          month: string
          pessoa: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente?: string
          created_at?: string
          id?: string
          month: string
          pessoa?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente?: string
          created_at?: string
          id?: string
          month?: string
          pessoa?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_authorized_editor: { Args: never; Returns: boolean }
      rename_sdr: {
        Args: { new_name: string; old_name: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
