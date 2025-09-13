import { get } from "./http";

export const fetchMe = async () => {
  try {
    const response = await get("/me");
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.log(error);
    return null;
  }
};
