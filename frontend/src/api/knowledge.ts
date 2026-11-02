/**
 * Knowledge Base API Client (Round 3)
 * Provides access to brand rules and verified factual assertions.
 */
import { api } from "./client";
import type { Rule, Fact } from "../types";

export const getRules = (): Promise<Rule[]> => api.knowledge.getRules();
export const getRule = (id: string): Promise<Rule> => api.knowledge.getRule(id);
export const createRule = (payload: Record<string, unknown>): Promise<Rule> => api.knowledge.createRule(payload);
export const getFacts = (): Promise<Fact[]> => api.knowledge.getFacts();
export const getFact = (id: string): Promise<Fact> => api.knowledge.getFact(id);

export const knowledgeApi = {
  getRules,
  getRule,
  createRule,
  getFacts,
  getFact,
};

export default knowledgeApi;
