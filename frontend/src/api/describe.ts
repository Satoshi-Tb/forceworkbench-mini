import { z } from "zod";
import { apiFetch, ensureOk, parseApiResponse } from "./client";

const sObjectSummarySchema = z.object({
  name: z.string(),
  label: z.string(),
  custom: z.boolean(),
  queryable: z.boolean(),
});

const picklistValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  active: z.boolean(),
  defaultValue: z.boolean(),
});

const fieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  referenceTo: z.array(z.string()),
  relationshipName: z.string().nullable(),
  soapType: z.string(),
  length: z.number(),
  byteLength: z.number(),
  digits: z.number(),
  precision: z.number(),
  scale: z.number(),
  nillable: z.boolean(),
  createable: z.boolean(),
  updateable: z.boolean(),
  defaultedOnCreate: z.boolean(),
  calculated: z.boolean(),
  autoNumber: z.boolean(),
  aiPredictionField: z.boolean(),
  aggregatable: z.boolean(),
  groupable: z.boolean(),
  filterable: z.boolean(),
  sortable: z.boolean(),
  caseSensitive: z.boolean(),
  searchPrefilterable: z.boolean(),
  idLookup: z.boolean(),
  nameField: z.boolean(),
  namePointing: z.boolean(),
  polymorphicForeignKey: z.boolean(),
  custom: z.boolean(),
  deprecatedAndHidden: z.boolean(),
  restrictedPicklist: z.boolean(),
  permissionable: z.boolean(),
  unique: z.boolean(),
  picklistValues: z.array(picklistValueSchema),
});

const childRelationshipSchema = z.object({
  childSObject: z.string(),
  field: z.string(),
  relationshipName: z.string().nullable(),
});

const describeGlobalSchema = z.object({
  sobjects: z.array(sObjectSummarySchema),
});

const describeSObjectSchema = z.object({
  name: z.string(),
  label: z.string(),
  custom: z.boolean(),
  searchable: z.boolean(),
  layoutable: z.boolean(),
  retrieveable: z.boolean(),
  createable: z.boolean(),
  updateable: z.boolean(),
  deletable: z.boolean(),
  mergeable: z.boolean(),
  queryable: z.boolean(),
  triggerable: z.boolean(),
  keyPrefix: z.string().nullable(),
  fields: z.array(fieldSchema),
  childRelationships: z.array(childRelationshipSchema),
});

export type SObjectSummary = z.infer<typeof sObjectSummarySchema>;
export type DescribeGlobal = z.infer<typeof describeGlobalSchema>;
export type PicklistValue = z.infer<typeof picklistValueSchema>;
export type Field = z.infer<typeof fieldSchema>;
export type ChildRelationship = z.infer<typeof childRelationshipSchema>;
export type DescribeSObject = z.infer<typeof describeSObjectSchema>;

export async function describeGlobal(): Promise<DescribeGlobal> {
  const res = await apiFetch("/api/describe/global");
  await ensureOk(res);
  const body: unknown = await res.json();
  return parseApiResponse(describeGlobalSchema, body);
}

export async function describeSObject(
  sobject: string,
): Promise<DescribeSObject> {
  const res = await apiFetch(`/api/describe/${sobject}`);
  await ensureOk(res);
  const body: unknown = await res.json();
  return parseApiResponse(describeSObjectSchema, body);
}
