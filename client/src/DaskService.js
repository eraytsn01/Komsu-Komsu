const DaskService = {
  adresVerisiCek: async (adim, id) => {
    try {
      // İstek artık doğrudan DASK'a değil, kendi backend'imizdeki proxy'ye yapılıyor (CORS'u aşmak için)
      const response = await fetch('/api/dask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: adim,
          id: id
        })
      });

      return await response.json(); // Gelen adres listesi
    } catch (error) {
      console.error("DASK Veri Çekme Hatası:", error);
      throw new Error("Adres bilgileri alınırken bir hata oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin.");
    }
  },
};

export default DaskService;