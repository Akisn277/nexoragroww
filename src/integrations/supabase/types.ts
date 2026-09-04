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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attention_events: {
        Row: {
          attention_score: number
          detected_at: string
          id: string
          market_significance: number
          personal_relevance: number
          snapshot_id: string
          status: Database["public"]["Enums"]["change_status"]
          symbol: string
          user_id: string
        }
        Insert: {
          attention_score: number
          detected_at?: string
          id?: string
          market_significance: number
          personal_relevance: number
          snapshot_id: string
          status?: Database["public"]["Enums"]["change_status"]
          symbol: string
          user_id: string
        }
        Update: {
          attention_score?: number
          detected_at?: string
          id?: string
          market_significance?: number
          personal_relevance?: number
          snapshot_id?: string
          status?: Database["public"]["Enums"]["change_status"]
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attention_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "market_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      market_events: {
        Row: {
          description: string | null
          event_time: string
          event_type: Database["public"]["Enums"]["market_event_type"]
          id: string
          importance: Database["public"]["Enums"]["event_importance"]
          source: string
          symbol: string
          title: string
        }
        Insert: {
          description?: string | null
          event_time: string
          event_type: Database["public"]["Enums"]["market_event_type"]
          id?: string
          importance?: Database["public"]["Enums"]["event_importance"]
          source?: string
          symbol: string
          title: string
        }
        Update: {
          description?: string | null
          event_time?: string
          event_type?: Database["public"]["Enums"]["market_event_type"]
          id?: string
          importance?: Database["public"]["Enums"]["event_importance"]
          source?: string
          symbol?: string
          title?: string
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          avg_volume: number
          benchmark_change: number
          change_percent: number
          company_name: string
          freshness: Database["public"]["Enums"]["data_freshness"]
          id: string
          observed_at: string
          price: number
          sector_change: number
          source: string
          symbol: string
          volatility: number
          volume: number
        }
        Insert: {
          avg_volume: number
          benchmark_change?: number
          change_percent: number
          company_name: string
          freshness?: Database["public"]["Enums"]["data_freshness"]
          id?: string
          observed_at: string
          price: number
          sector_change?: number
          source?: string
          symbol: string
          volatility: number
          volume: number
        }
        Update: {
          avg_volume?: number
          benchmark_change?: number
          change_percent?: number
          company_name?: string
          freshness?: Database["public"]["Enums"]["data_freshness"]
          id?: string
          observed_at?: string
          price?: number
          sector_change?: number
          source?: string
          symbol?: string
          volatility?: number
          volume?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          attention_sensitivity: Database["public"]["Enums"]["attention_sensitivity"]
          created_at: string
          default_watchlist_id: string | null
          display_name: string | null
          id: string
          last_seen_at: string | null
        }
        Insert: {
          attention_sensitivity?: Database["public"]["Enums"]["attention_sensitivity"]
          created_at?: string
          default_watchlist_id?: string | null
          display_name?: string | null
          id: string
          last_seen_at?: string | null
        }
        Update: {
          attention_sensitivity?: Database["public"]["Enums"]["attention_sensitivity"]
          created_at?: string
          default_watchlist_id?: string | null
          display_name?: string | null
          id?: string
          last_seen_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_watchlist_fk"
            columns: ["default_watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_items: {
        Row: {
          added_at: string
          id: string
          priority: Database["public"]["Enums"]["item_priority"]
          symbol: string
          watchlist_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["item_priority"]
          symbol: string
          watchlist_id: string
        }
        Update: {
          added_at?: string
          id?: string
          priority?: Database["public"]["Enums"]["item_priority"]
          symbol?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      attention_sensitivity: "conservative" | "balanced" | "sensitive"
      change_status: "NEW" | "SEEN" | "ACKNOWLEDGED"
      data_freshness: "fresh" | "delayed" | "stale"
      event_importance: "low" | "medium" | "high"
      item_priority: "normal" | "high"
      market_event_type:
        | "earnings"
        | "dividend"
        | "split"
        | "bonus"
        | "announcement"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      attention_sensitivity: ["conservative", "balanced", "sensitive"],
      change_status: ["NEW", "SEEN", "ACKNOWLEDGED"],
      data_freshness: ["fresh", "delayed", "stale"],
      event_importance: ["low", "medium", "high"],
      item_priority: ["normal", "high"],
      market_event_type: [
        "earnings",
        "dividend",
        "split",
        "bonus",
        "announcement",
      ],
    },
  },
} as const
