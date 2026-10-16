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
      acknowledgements: {
        Row: {
          acknowledged_at: string
          challenge_slug: string
          challenge_version: number
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          challenge_slug: string
          challenge_version: number
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          challenge_slug?: string
          challenge_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgements_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          audiences: Database["public"]["Enums"]["audience"][]
          description: string | null
          image: string | null
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          archived?: boolean
          audiences: Database["public"]["Enums"]["audience"][]
          description?: string | null
          image?: string | null
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          archived?: boolean
          audiences?: Database["public"]["Enums"]["audience"][]
          description?: string | null
          image?: string | null
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      challenge_feedback: {
        Row: {
          body: string
          challenge_slug: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          body: string
          challenge_slug: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          challenge_slug?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_feedback_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "challenge_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_keys: {
        Row: {
          answer_key: Json
          challenge_slug: string
          explanations: Json
          grader_notes: string | null
        }
        Insert: {
          answer_key?: Json
          challenge_slug: string
          explanations?: Json
          grader_notes?: string | null
        }
        Update: {
          answer_key?: Json
          challenge_slug?: string
          explanations?: Json
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
      challenge_settings_audit: {
        Row: {
          challenge_slug: string
          changed_at: string
          changed_by: string | null
          field: string
          id: number
          new_value: Json | null
          old_value: Json | null
          source: string
        }
        Insert: {
          challenge_slug: string
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          source: string
        }
        Update: {
          challenge_slug?: string
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_settings_audit_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "challenge_settings_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          audiences: Database["public"]["Enums"]["audience"][]
          body_md: string
          category_slug: string
          content_hash: string
          difficulty: number
          due_at: string | null
          estimated_minutes: number | null
          feedback_mode: string
          help_link: Json | null
          image: string | null
          image_offset_x: number
          image_offset_y: number
          image_scale: number
          path_slug: string | null
          points: number
          questions: Json
          required_for: Database["public"]["Enums"]["audience"][]
          rubric: Json
          slug: string
          status: string
          submission_spec: Json
          summary: string | null
          tip: string | null
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at: string
          version: number
          waiting_minutes: number | null
        }
        Insert: {
          audiences: Database["public"]["Enums"]["audience"][]
          body_md: string
          category_slug: string
          content_hash: string
          difficulty: number
          due_at?: string | null
          estimated_minutes?: number | null
          feedback_mode?: string
          help_link?: Json | null
          image?: string | null
          image_offset_x?: number
          image_offset_y?: number
          image_scale?: number
          path_slug?: string | null
          points: number
          questions?: Json
          required_for?: Database["public"]["Enums"]["audience"][]
          rubric?: Json
          slug: string
          status?: string
          submission_spec?: Json
          summary?: string | null
          tip?: string | null
          title: string
          type: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
          version?: number
          waiting_minutes?: number | null
        }
        Update: {
          audiences?: Database["public"]["Enums"]["audience"][]
          body_md?: string
          category_slug?: string
          content_hash?: string
          difficulty?: number
          due_at?: string | null
          estimated_minutes?: number | null
          feedback_mode?: string
          help_link?: Json | null
          image?: string | null
          image_offset_x?: number
          image_offset_y?: number
          image_scale?: number
          path_slug?: string | null
          points?: number
          questions?: Json
          required_for?: Database["public"]["Enums"]["audience"][]
          rubric?: Json
          slug?: string
          status?: string
          submission_spec?: Json
          summary?: string | null
          tip?: string | null
          title?: string
          type?: Database["public"]["Enums"]["challenge_type"]
          updated_at?: string
          version?: number
          waiting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "challenges_path_slug_fkey"
            columns: ["path_slug"]
            isOneToOne: false
            referencedRelation: "paths"
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
      path_settings_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: number
          new_value: Json | null
          old_value: Json | null
          path_slug: string
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          path_slug: string
          source: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          path_slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_settings_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_settings_audit_path_slug_fkey"
            columns: ["path_slug"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["slug"]
          },
        ]
      }
      paths: {
        Row: {
          audiences: Database["public"]["Enums"]["audience"][]
          before_you_start: string | null
          before_you_submit: string[]
          category_slug: string
          created_at: string
          due_at: string | null
          image: string | null
          image_offset_x: number
          image_offset_y: number
          image_scale: number
          milestones: string[]
          required_for: Database["public"]["Enums"]["audience"][]
          requires: string[]
          sequential: boolean
          slug: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          audiences: Database["public"]["Enums"]["audience"][]
          before_you_start?: string | null
          before_you_submit?: string[]
          category_slug: string
          created_at?: string
          due_at?: string | null
          image?: string | null
          image_offset_x?: number
          image_offset_y?: number
          image_scale?: number
          milestones: string[]
          required_for?: Database["public"]["Enums"]["audience"][]
          requires?: string[]
          sequential?: boolean
          slug: string
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          audiences?: Database["public"]["Enums"]["audience"][]
          before_you_start?: string | null
          before_you_submit?: string[]
          category_slug?: string
          created_at?: string
          due_at?: string | null
          image?: string | null
          image_offset_x?: number
          image_offset_y?: number
          image_scale?: number
          milestones?: string[]
          required_for?: Database["public"]["Enums"]["audience"][]
          requires?: string[]
          sequential?: boolean
          slug?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paths_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      profile_flag_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: number
          new_value: boolean
          old_value: boolean | null
          profile_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: never
          new_value: boolean
          old_value?: boolean | null
          profile_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: never
          new_value?: boolean
          old_value?: boolean | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_flag_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_flag_audit_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          is_tester: boolean
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
          is_tester?: boolean
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
          is_tester?: boolean
          show_on_leaderboard?: boolean
          track?: Database["public"]["Enums"]["track"] | null
        }
        Relationships: []
      }
      staff_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          email: string
          field: string
          id: number
          new_value: string | null
          note: string | null
          old_value: string | null
          source: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          email: string
          field: string
          id?: never
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          email?: string
          field?: string
          id?: never
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_titles: {
        Row: {
          email: string
          job_title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          email: string
          job_title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          email?: string
          job_title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_titles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_drafts: {
        Row: {
          answers: Json
          challenge_slug: string
          challenge_version: number
          current_step: number
          figma_url: string | null
          image_paths: string[]
          instant_tries: Json | null
          reflection: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          challenge_slug: string
          challenge_version: number
          current_step?: number
          figma_url?: string | null
          image_paths?: string[]
          instant_tries?: Json | null
          reflection?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          challenge_slug?: string
          challenge_version?: number
          current_step?: number
          figma_url?: string | null
          image_paths?: string[]
          instant_tries?: Json | null
          reflection?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_drafts_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "submission_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_import_audit: {
        Row: {
          action: string
          challenge_slug: string
          changed_at: string
          changed_by: string | null
          feedback: string | null
          final_score: number
          id: number
          max_score: number
          source: string
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
          user_id: string
        }
        Insert: {
          action: string
          challenge_slug: string
          changed_at?: string
          changed_by?: string | null
          feedback?: string | null
          final_score: number
          id?: never
          max_score: number
          source: string
          status: Database["public"]["Enums"]["submission_status"]
          submission_id: string
          user_id: string
        }
        Update: {
          action?: string
          challenge_slug?: string
          changed_at?: string
          changed_by?: string | null
          feedback?: string | null
          final_score?: number
          id?: never
          max_score?: number
          source?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_import_audit_challenge_slug_fkey"
            columns: ["challenge_slug"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "submission_import_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_import_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          imported_at: string | null
          imported_by: string | null
          is_imported: boolean
          is_test: boolean
          max_score: number
          published_at: string | null
          question_tries: Json | null
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
          imported_at?: string | null
          imported_by?: string | null
          is_imported?: boolean
          is_test?: boolean
          max_score: number
          published_at?: string | null
          question_tries?: Json | null
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
          imported_at?: string | null
          imported_by?: string | null
          is_imported?: boolean
          is_test?: boolean
          max_score?: number
          published_at?: string | null
          question_tries?: Json | null
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
            foreignKeyName: "submissions_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
        Args: { p_tracks: Database["public"]["Enums"]["track"][] }
        Returns: {
          avatar_url: string
          completed: number
          full_name: string
          total_score: number
          track: Database["public"]["Enums"]["track"]
          user_id: string
        }[]
      }
      import_submission: {
        Args: {
          p_actor: string
          p_challenge: string
          p_feedback: string
          p_score: number
          p_source: string
          p_status: Database["public"]["Enums"]["submission_status"]
          p_user: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_tester: { Args: never; Returns: boolean }
      my_track_sees: {
        Args: { a: Database["public"]["Enums"]["audience"][] }
        Returns: boolean
      }
      record_instant_try: {
        Args: {
          p_challenge: string
          p_correct: boolean
          p_is_test: boolean
          p_question: string
          p_user: string
          p_version: number
        }
        Returns: Json
      }
      rename_staff_email: {
        Args: { p_actor: string; p_new: string; p_old: string }
        Returns: boolean
      }
      require_admin_actor: { Args: { p_actor: string }; Returns: undefined }
      set_challenge_setting: {
        Args: {
          p_actor?: string
          p_field: string
          p_slug: string
          p_source: string
          p_value: Json
        }
        Returns: boolean
      }
      set_path_setting: {
        Args: {
          p_actor?: string
          p_field: string
          p_slug: string
          p_source: string
          p_value: Json
        }
        Returns: boolean
      }
      set_path_status: {
        Args: {
          p_actor?: string
          p_publish_milestones?: boolean
          p_slug: string
          p_source: string
          p_value: string
        }
        Returns: boolean
      }
      set_staff_title: {
        Args: {
          p_actor?: string
          p_email: string
          p_source: string
          p_title: string
        }
        Returns: boolean
      }
      set_user_tester: {
        Args: { p_actor: string; p_user: string; p_value: boolean }
        Returns: boolean
      }
      set_user_track: {
        Args: {
          p_actor: string
          p_track: Database["public"]["Enums"]["track"]
          p_user: string
        }
        Returns: boolean
      }
      undo_import: {
        Args: { p_actor: string; p_source: string; p_submission: string }
        Returns: undefined
      }
      valid_audiences: {
        Args: { a: Database["public"]["Enums"]["audience"][] }
        Returns: boolean
      }
    }
    Enums: {
      audience:
        | "all"
        | "strategist"
        | "designer"
        | "account_manager"
        | "assistant"
        | "motion_designer"
        | "management"
      challenge_type: "quiz" | "screenshot" | "figma" | "mixed" | "acknowledge"
      submission_status:
        | "submitted"
        | "ai_reviewed"
        | "published"
        | "needs_resubmission"
      track:
        | "strategist"
        | "designer"
        | "account_manager"
        | "assistant"
        | "motion_designer"
        | "management"
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
      audience: [
        "all",
        "strategist",
        "designer",
        "account_manager",
        "assistant",
        "motion_designer",
        "management",
      ],
      challenge_type: ["quiz", "screenshot", "figma", "mixed", "acknowledge"],
      submission_status: [
        "submitted",
        "ai_reviewed",
        "published",
        "needs_resubmission",
      ],
      track: [
        "strategist",
        "designer",
        "account_manager",
        "assistant",
        "motion_designer",
        "management",
      ],
    },
  },
} as const
