-- Migration: Add SPECIAL_7V7 to session_mode ENUM
-- Milestone 1: Database Schema Migration for 7v7 Special Mode
ALTER TYPE session_mode ADD VALUE IF NOT EXISTS 'SPECIAL_7V7';
