"use server";
import { cookies } from "next/headers";
export async function exitDemo() {
  (await cookies()).delete("glowbook-demo");
}
