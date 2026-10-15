export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
  fieldErrors?: Partial<Record<"email" | "password" | "confirmPassword", string>>;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
  message: "",
};
