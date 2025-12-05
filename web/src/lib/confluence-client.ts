import axios from "axios";

interface ConfluenceSettings {
  domain: string;
  email: string;
  apiToken: string;
}

export const getApiClient = (settings: ConfluenceSettings) => {
  const client = axios.create({
    baseURL: "/api",
    headers: {
      "x-confluence-domain": settings.domain,
      "x-confluence-email": settings.email,
      "x-confluence-token": settings.apiToken,
    },
  });

  return {
    getSpaces: async () => {
      const res = await client.get("/spaces");
      return res.data;
    },

    searchPages: async (query?: string, spaceKey?: string) => {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (spaceKey) params.set("spaceKey", spaceKey);
      const queryString = params.toString();

      const res = await client.get(`/pages${queryString ? `?${queryString}` : ""}`);
      return res.data;
    },

    createPage: async (data: { title: string; spaceKey: string; content: string }) => {
      const res = await client.post("/pages", data);
      return res.data;
    },

    getPage: async (id: string) => {
      const res = await client.get(`/pages/${id}`);
      return res.data;
    },

    updatePage: async (id: string, data: { title: string; content: string }) => {
      const res = await client.put(`/pages/${id}`, data);
      return res.data;
    },
  };
};
