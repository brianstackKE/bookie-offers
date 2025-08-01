"use client";
import { useParams } from "next/navigation";
import HomeNavbar from "../../../components/HomeNavbar";
import Footer from "../../../components/Footer";
import Link from "next/link";
import { client } from "../../../sanity/lib/client";
import imageUrlBuilder from '@sanity/image-url';
import { useEffect, useState } from "react";
import { PortableText } from '@portabletext/react';
import { useRouter } from "next/navigation";
import Image from "next/image";

const builder = imageUrlBuilder(client);
function urlFor(source) {
  return builder.image(source).url();
}

function ArticleInner({ slug }) {
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [articleData, allArticles] = await Promise.all([
          client.fetch(`*[_type == "article" && slug.current == $slug][0]{
            _id,
            title,
            slug,
            mainImage,
            content
          }`, { slug }),
          client.fetch(`*[_type == "article"]|order(_createdAt desc){
            _id,
            title,
            slug,
            mainImage
          }`)
        ]);
        setArticle(articleData);
        setArticles(allArticles);
        setLoading(false);
      } catch (err) {
        setError("Failed to load article");
        setLoading(false);
      }
    }
    fetchData();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex flex-col bg-[#fafbfc]"><HomeNavbar /><main className="flex-1 max-w-4xl mx-auto py-16 px-4">Loading...</main><Footer /></div>;
  }
  if (error || !article) {
    return <div className="min-h-screen flex flex-col bg-[#fafbfc]"><HomeNavbar /><main className="flex-1 max-w-4xl mx-auto py-16 px-4">Article not found</main><Footer /></div>;
  }

  // Sidebar and Read More
  const sidebarArticles = articles.slice(0, 5);
  const readMoreArticles = articles.filter(a => a.slug.current !== article.slug.current).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc]">
      <HomeNavbar />
      <main className="flex-1 max-w-6xl mx-auto py-10 px-4 w-full">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.back()}
            className="focus:outline-none"
            aria-label="Go back"
          >
            <Image src="/assets/back-arrow.png" alt="Back" width={28} height={28} />
          </button>
          <h1 className="text-3xl font-bold">{article.title}</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Article Content */}
          <div className="flex-1">
            <div className="text-gray-700 text-base space-y-6 mb-8">
              <PortableText value={article.content} />
            </div>
          </div>
          {/* Sidebar */}
          <aside className="w-full md:w-80 flex-shrink-0">
            <div className="flex flex-col gap-4">
              {sidebarArticles.map((a) => {
                const isActive = a.slug.current === article.slug.current;
                return (
                  <Link
                    key={a._id}
                    href={`/briefly/${a.slug.current}`}
                    className={`flex gap-3 items-center bg-white rounded-lg shadow-sm p-2 transition hover:shadow-lg hover:scale-[1.03] cursor-pointer ${isActive ? "border-2 border-green-600" : ""}`}
                  >
                    <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-gray-100">
                      {a.mainImage ? (
                        <img src={urlFor(a.mainImage)} alt={a.title} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 leading-tight">
                      {a.title}
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
        {/* Read More Section */}
        <hr className="my-10 border-gray-200" />
        <div className="flex items-center gap-2 mb-6">
          <span className="text-green-700 text-2xl">●</span>
          <h2 className="text-2xl font-bold">Read More</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-10">
          {readMoreArticles.map((a) => (
            <Link
              key={a._id}
              href={`/briefly/${a.slug.current}`}
              className="flex flex-col items-center bg-white rounded-lg shadow-sm p-4 transition hover:shadow-lg hover:scale-[1.03] cursor-pointer"
            >
              <div className="w-32 h-32 rounded overflow-hidden bg-gray-100 mb-3">
                {a.mainImage ? (
                  <img src={urlFor(a.mainImage)} alt={a.title} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="text-base font-semibold text-gray-900 leading-tight text-center">
                {a.title}
              </div>
              <span className="mt-2 px-3 py-1 bg-green-700 text-white text-xs rounded">Briefly</span>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ArticleInner; 