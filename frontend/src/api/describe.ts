import { apiFetch, ensureOk } from "./client";

export type SObjectSummary = {
  name: string;
  label: string;
  custom: boolean;
};

export type DescribeGlobal = {
  sobjects: SObjectSummary[];
};

export type Field = {
  name: string;
  label: string;
  type: string;
  referenceTo: string[];
  relationshipName: string | null;
  soapType: string;
  length: number;
  byteLength: number;
  digits: number;
  precision: number;
  scale: number;
  nillable: boolean;
  createable: boolean;
  updateable: boolean;
  defaultedOnCreate: boolean;
  calculated: boolean;
  autoNumber: boolean;
  aiPredictionField: boolean;
  aggregatable: boolean;
  groupable: boolean;
  filterable: boolean;
  sortable: boolean;
  caseSensitive: boolean;
  searchPrefilterable: boolean;
  idLookup: boolean;
  nameField: boolean;
  namePointing: boolean;
  polymorphicForeignKey: boolean;
  custom: boolean;
  deprecatedAndHidden: boolean;
  restrictedPicklist: boolean;
  permissionable: boolean;
  unique: boolean;
  picklistValues: PicklistValue[];
};

export type PicklistValue = {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
};

export type ChildRelationship = {
  childSObject: string;
  field: string;
  relationshipName: string;
};

export type DescribeSObject = {
  name: string;
  label: string;
  custom: boolean;
  searchable: boolean;
  layoutable: boolean;
  retrieveable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  mergeable: boolean;
  queryable: boolean;
  triggerable: boolean;
  keyPrefix: string | null;
  fields: Field[];
  childRelationships: ChildRelationship[];
};

export async function describeGlobal(): Promise<DescribeGlobal> {
  const res = await apiFetch("/api/describe/global");
  await ensureOk(res);
  return res.json();
}

export async function describeSObject(
  sobject: string,
): Promise<DescribeSObject> {
  const res = await apiFetch(`/api/describe/${sobject}`);
  await ensureOk(res);
  return res.json();
}
