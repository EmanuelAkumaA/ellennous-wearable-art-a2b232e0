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
      admin_profile: {
        Row: {
          avatar_storage_path: string | null
          avatar_url: string | null
          display_name: string | null
          palette_colors: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_storage_path?: string | null
          avatar_url?: string | null
          display_name?: string | null
          palette_colors?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_storage_path?: string | null
          avatar_url?: string | null
          display_name?: string | null
          palette_colors?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_telemetry: {
        Row: {
          created_at: string
          event_type: string
          id: string
          meta: Json
          session_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          session_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      conversion_logs: {
        Row: {
          created_at: string
          desktop_path: string | null
          duration_ms: number
          error_message: string | null
          filename: string
          id: string
          optimized_size: number
          original_format: string | null
          original_size: number
          piece_id: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desktop_path?: string | null
          duration_ms?: number
          error_message?: string | null
          filename: string
          id?: string
          optimized_size?: number
          original_format?: string | null
          original_size?: number
          piece_id?: string | null
          source: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          desktop_path?: string | null
          duration_ms?: number
          error_message?: string | null
          filename?: string
          id?: string
          optimized_size?: number
          original_format?: string | null
          original_size?: number
          piece_id?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      gallery_categories: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery_piece_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          piece_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          piece_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          piece_id?: string
          session_id?: string
        }
        Relationships: []
      }
      gallery_piece_images: {
        Row: {
          created_at: string
          id: string
          ordem: number
          piece_id: string
          storage_path: string | null
          url: string
          variant_overrides: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          piece_id: string
          storage_path?: string | null
          url: string
          variant_overrides?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          piece_id?: string
          storage_path?: string | null
          url?: string
          variant_overrides?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_piece_images_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "gallery_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_pieces: {
        Row: {
          categoria_id: string
          conceito: string
          cover_fit: string
          cover_image_id: string | null
          cover_path_mobile: string | null
          cover_path_tablet: string | null
          cover_position: string
          cover_storage_path: string | null
          cover_url: string | null
          cover_url_mobile: string | null
          cover_url_tablet: string | null
          created_at: string
          descricao: string
          destaque: boolean
          historia: string
          id: string
          nome: string
          novo: boolean
          ordem: number
          tempo: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          conceito?: string
          cover_fit?: string
          cover_image_id?: string | null
          cover_path_mobile?: string | null
          cover_path_tablet?: string | null
          cover_position?: string
          cover_storage_path?: string | null
          cover_url?: string | null
          cover_url_mobile?: string | null
          cover_url_tablet?: string | null
          created_at?: string
          descricao?: string
          destaque?: boolean
          historia?: string
          id?: string
          nome: string
          novo?: boolean
          ordem?: number
          tempo?: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          conceito?: string
          cover_fit?: string
          cover_image_id?: string | null
          cover_path_mobile?: string | null
          cover_path_tablet?: string | null
          cover_position?: string
          cover_storage_path?: string | null
          cover_url?: string | null
          cover_url_mobile?: string | null
          cover_url_tablet?: string | null
          created_at?: string
          descricao?: string
          destaque?: boolean
          historia?: string
          id?: string
          nome?: string
          novo?: boolean
          ordem?: number
          tempo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_pieces_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "gallery_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_staging_images: {
        Row: {
          created_at: string
          desktop_path: string
          desktop_url: string
          id: string
          mobile_path: string
          original_filename: string
          sizes: Json
          tablet_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desktop_path: string
          desktop_url: string
          id?: string
          mobile_path: string
          original_filename: string
          sizes?: Json
          tablet_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          desktop_path?: string
          desktop_url?: string
          id?: string
          mobile_path?: string
          original_filename?: string
          sizes?: Json
          tablet_path?: string
          user_id?: string
        }
        Relationships: []
      }
      review_invites: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          note: string | null
          revoked: boolean
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          note?: string | null
          revoked?: boolean
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          note?: string | null
          revoked?: boolean
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          city: string | null
          client_name: string
          client_role: string | null
          content: string
          created_at: string
          id: string
          instagram: string | null
          invite_id: string | null
          ordem: number
          photo_storage_path: string | null
          photo_url: string | null
          rating: number
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          client_name: string
          client_role?: string | null
          content: string
          created_at?: string
          id?: string
          instagram?: string | null
          invite_id?: string | null
          ordem?: number
          photo_storage_path?: string | null
          photo_url?: string | null
          rating: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          client_name?: string
          client_role?: string | null
          content?: string
          created_at?: string
          id?: string
          instagram?: string | null
          invite_id?: string | null
          ordem?: number
          photo_storage_path?: string | null
          photo_url?: string | null
          rating?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "review_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
