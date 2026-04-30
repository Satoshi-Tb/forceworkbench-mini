import { apiFetch, ensureOk } from "./client";

export type SObjectSummary = {
  name: string;
  label: string;
};

export type DescribeGlobal = {
  sobjects: SObjectSummary[];
};

export type Field = {
  name: string;
  label: string;
  type: string;
};

export type ChildRelationship = {
  childSObject: string;
  field: string;
  relationshipName: string;
};

export type DescribeSObject = {
  name: string;
  label: string;
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
