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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      allowed_email_domains: {
        Row: {
          domain: string
        }
        Insert: {
          domain: string
        }
        Update: {
          domain?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          audience: Database["public"]["Enums"]["audience"]
          description: string | null
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          archived?: boolean
          audience: Database["public"]["Enums"]["audience"]
          description?: string | null
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          archived?: boolean
          audience?: Database["public"]["Enums"]["audience"]
          description?: string | null
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      challenge_keys: {
        Row: {
          answer_key: Json
          challenge_slug: string
          grader_notes: string | null
        }
        Insert: {
          answer_key?: Json
          challenge_slug: string
          grader_notes?: string | null
        }
        Update: {
          answer_key?: Json
          challenge_slug?: string
          grader_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_keys_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: true
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
        ]
      }
      challenges: {
        Row: {
          audience: Database["public"]["Enums"]["audience"]
          body_md: string
          category_slug: string
          content_hash: string
          difficulty: number
          due_at: string | null
          estimated_minutes: number | null
          points: number
          questions: Json
          rubric: Json
          slug: string
          status: string
          submission_spec: Json
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at: string
          version: number
        }
        Insert: {
          audience: Database["public"]["Enums"]["audience"]
          body_md: string
          category_slug: string
          content_hash: string
          difficulty: number
          due_at?: string | null
          estimated_minutes?: number | null
          points: number
          questions?: Json
          rubric?: Json
          slug: string
          status?: string
          submission_spec?: Json
          summary?: string | null
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience"]
          body_md?: string
          category_slug?: string
          content_hash?: string
          difficulty?: number
          due_at?: string | null
          estimated_minutes?: number | null
          points?: number
          questions?: Json
          rubric?: Json
          slug?: string
          status?: string
          submission_spec?: Json
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenges_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      evaluations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string
          confidence: string
          created_at: string
          criteria: Json
          feedback: string
          flags: string[]
          id: string
          model: string | null
          submission_id: string
          total: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id: string
          confidence: string
          created_at?: string
          criteria: Json
          feedback: string
          flags?: string[]
          id?: string
          model?: string | null
          submission_id: string
          total: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string
          confidence?: string
          created_at?: string
          criteria?: Json
          feedback?: string
          flags?: string[]
          id?: string
          model?: string | null
          submission_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_admin: boolean
          show_on_leaderboard: boolean
          track: Database["public"]["Enums"]["track"] | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          show_on_leaderboard?: boolean
          track?: Database["public"]["Enums"]["track"] | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          show_on_leaderboard?: boolean
          track?: Database["public"]["Enums"]["track"] | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          answers: Json
          attempt: number
          auto_score: number
          challenge_slug: string
          challenge_version: number
          feedback: string | null
          figma_url: string | null
          final_score: number | null
          id: string
          image_paths: string[]
          max_score: number
          published_at: string | null
          reflection: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt?: number
          auto_score?: number
          challenge_slug: string
          challenge_version: number
          feedback?: string | null
          figma_url?: string | null
          final_score?: number | null
          id?: string
          image_paths?: string[]
          max_score: number
          published_at?: string | null
          reflection?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          attempt?: number
          auto_score?: number
          challenge_slug?: string
          challenge_version?: number
          feedback?: string | null
          figma_url?: string | null
          final_score?: number | null
          id?: string
          image_paths?: string[]
          max_score?: number
          published_at?: string | null
          reflection?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: { p_track: Database["public"]["Enums"]["track"] }
        Returns: {
          avatar_url: string
          completed: number
          full_name: string
          total_score: number
          user_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      audience: "all" | "strategist" | "designer"
      challenge_type: "quiz" | "screenshot" | "figma" | "mixed"
      submission_status:
        | "submitted"
        | "ai_reviewed"
        | "published"
        | "needs_resubmission"
      track: "strategist" | "designer"
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
      audience: ["all", "strategist", "designer"],
      challenge_type: ["quiz", "screenshot", "figma", "mixed"],
      submission_status: [
        "submitted",
        "ai_reviewed",
        "published",
        "needs_resubmission",
      ],
      track: ["strategist", "designer"],
    },
  },
} as const
