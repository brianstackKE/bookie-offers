"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { client } from "../sanity/lib/client";
import { urlFor } from "../sanity/lib/image";
import Link from "next/link";

const flags = [
  { src: "/assets/flags.png", name: "World Wide", path: "/", topIcon: "/assets/dropdown.png" },
  { src: "/assets/ghana-square.png", name: "Ghana", path: "/gh", topIcon: "/assets/ghana.png" },
  { src: "/assets/nigeria-square.png", name: "Nigeria", path: "/ng", topIcon: "/assets/nigeria.png" },
];

const popularSearches = [
  "Welcome bonus",
  "Deposit bonus",
  "Best bonus",
  "Best bookies",
  "Best bookies"
];

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(flags[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const router = useRouter();
  const pathname = usePathname();
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const searchDebounceRef = useRef();
  const menuRef = useRef();

  // Load recent searches from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recentSearches');
      if (stored) setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Save recent searches to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    }
  }, [recentSearches]);

  // Add to recent searches when a search is performed
  const addRecentSearch = (term) => {
    if (!term) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
      return [term, ...filtered].slice(0, 5); // Keep max 5
    });
  };

  // Update selected flag based on current path
  useEffect(() => {
    let currentFlag = flags[0];
    if (pathname.startsWith("/ng")) {
      currentFlag = flags.find(flag => flag.name === "Nigeria");
    } else if (pathname.startsWith("/gh")) {
      currentFlag = flags.find(flag => flag.name === "Ghana");
    } else if (pathname === "/") {
      currentFlag = flags[0];
    }
    setSelectedFlag(currentFlag);
  }, [pathname]);

  // Determine country from pathname
  const country = pathname.startsWith("/ng") ? "Nigeria" : pathname.startsWith("/gh") ? "Ghana" : null;

  // Search handler
  const handleSearch = async (term) => {
    if (!term) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    addRecentSearch(term);
    try {
      let results = [];
      
      // Search offers (filtered by current country only)
      if (country) {
        const offersQuery = `*[_type == "offers" && country == $country && (
        bonusType->name match $term ||
          bookmaker->name match $term ||
          pt::text(description) match $term
      )] | order(_createdAt desc) {
        _id,
        slug,
          bonusType->{
            _id,
            name
          },
          bookmaker->{
            _id,
            name,
            logo,
            paymentMethods
          },
        country,
        maxBonus,
        minDeposit,
        description,
        expires,
        published,
          _type
        }`;
        const offersResults = await client.fetch(offersQuery, { country, term: `*${term}*` });
        console.log('Offers search results:', offersResults); // Debug log
        results = [...results, ...offersResults];
      }
      
      // Search articles (worldwide)
      const articlesQuery = `*[_type == "article" && (
        title match $term ||
        pt::text(content) match $term ||
        excerpt match $term
      )] | order(_createdAt desc) {
        _id,
        slug,
        title,
        excerpt,
        publishedAt,
        _type
      }`;
      const articlesResults = await client.fetch(articlesQuery, { term: `*${term}*` });
      results = [...results, ...articlesResults];
      
      // Search bookmakers (worldwide) - only if no offers found for this bookmaker
      const bookmakersQuery = `*[_type == "bookmaker" && (
        name match $term ||
        pt::text(description) match $term
      )] | order(_createdAt desc) {
        _id,
        name,
        description,
        logo,
        country,
        slug,
        _type
      }`;
      const bookmakersResults = await client.fetch(bookmakersQuery, { term: `*${term}*` });
      
      // Only add bookmaker results if we don't already have offers from these bookmakers
      const existingBookmakerIds = results
        .filter(item => item._type === 'offers' && item.bookmaker?._id)
        .map(item => item.bookmaker._id);
      
      const uniqueBookmakers = bookmakersResults.filter(
        bookmaker => !existingBookmakerIds.includes(bookmaker._id)
      );
      
      results = [...results, ...uniqueBookmakers];
      
      // Search bonus types (worldwide)
      const bonusTypesQuery = `*[_type == "bonusType" && (
        name match $term ||
        pt::text(description) match $term
      )] | order(_createdAt desc) {
        _id,
        name,
        description,
        slug,
        _type
      }`;
      const bonusTypesResults = await client.fetch(bonusTypesQuery, { term: `*${term}*` });
      results = [...results, ...bonusTypesResults];
      
      // Search banners (current country only)
      if (country) {
        const bannersQuery = `*[_type == "banner" && country == $country && (
          title match $term ||
          pt::text(imageAlt) match $term
        )] | order(order asc) {
          _id,
          title,
          image,
          imageAlt,
          country,
          order,
          isActive,
          _type
        }`;
        const bannersResults = await client.fetch(bannersQuery, { country, term: `*${term}*` });
        results = [...results, ...bannersResults];
      }
      
      // Search comparison content (current country only)
      if (country) {
        const comparisonQuery = `*[_type == "comparison" && country == $country && (
          title match $term ||
          pt::text(content) match $term
        )] | order(order asc) {
          _id,
          title,
          content,
          country,
          isActive,
          order,
          _type
        }`;
        const comparisonResults = await client.fetch(comparisonQuery, { country, term: `*${term}*` });
        results = [...results, ...comparisonResults];
      }
      
      // Search FAQ (worldwide)
      const faqQuery = `*[_type == "faq" && (
        question match $term ||
        pt::text(answer) match $term
      )] | order(_createdAt desc) {
        _id,
        question,
        answer,
        _type
      }`;
      const faqResults = await client.fetch(faqQuery, { term: `*${term}*` });
      results = [...results, ...faqResults];
      
      // Deduplicate results based on _id and _type
      const uniqueResults = results.reduce((acc, item) => {
        const key = `${item._type}-${item._id}`;
        if (!acc.some(existing => `${existing._type}-${existing._id}` === key)) {
          acc.push(item);
        }
        return acc;
      }, []);
      
      console.log('Search results before deduplication:', results.length);
      console.log('Search results after deduplication:', uniqueResults.length);
      console.log('Unique results:', uniqueResults.map(item => `${item._type}: ${item._id}`));
      
      setSearchResults(uniqueResults);
    } catch (err) {
      setSearchError("Failed to search content");
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (!searchOpen) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchValue) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchDebounceRef.current = setTimeout(() => {
      handleSearch(searchValue);
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchValue, searchOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleFlagSelect = (flag) => {
    setSelectedFlag(flag);
    setDropdownOpen(false);
    router.push(flag.path);
  };

  return (
    <>
    <nav className="w-full flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {/* Hamburger/X Toggle */}
        <button className="p-2 focus:outline-none" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <>
              <span className="block w-6 h-0.5 bg-gray-800 mb-1"></span>
              <span className="block w-6 h-0.5 bg-gray-800 mb-1"></span>
              <span className="block w-6 h-0.5 bg-gray-800"></span>
            </>
          )}
        </button>
        {/* Logo - hide on mobile when search is open */}
        <Link href={pathname.startsWith("/ng") ? "/ng" : pathname.startsWith("/gh") ? "/gh" : "/"} className={`${searchOpen ? 'hidden sm:block' : ''}`}>
          <Image src="/assets/logo.png" alt="Booldo Logo" width={80} height={80} className="cursor-pointer" />
        </Link>
      </div>
      {/* Search & Flag */}
      <div className="flex items-center gap-0 sm:gap-4 flex-1 justify-end">
        {/* Search input - desktop only */}
        <div className="hidden sm:flex items-center bg-[#f6f7f9] border border-gray-200 rounded-lg px-3 py-1 w-48 cursor-pointer" onClick={() => setSearchOpen(true)}>
          <svg className="text-gray-400 mr-2" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-gray-700 w-full placeholder-gray-400"
            value={searchValue}
            onChange={e => { setSearchValue(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            readOnly={!searchOpen}
          />
        </div>
        {/* Search icon - mobile only */}
        {!searchOpen && (
          <button className="flex sm:hidden p-2" onClick={() => setSearchOpen(true)}>
            <svg className="text-gray-400" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        )}
        {/* Search input - mobile only, expanded when open */}
        {searchOpen && (
          <div className="flex sm:hidden items-center bg-[#f6f7f9] border border-gray-200 rounded-lg px-3 py-1 w-full max-w-xs flex-1">
            <svg className="text-gray-400 mr-2" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none text-gray-700 w-full placeholder-gray-400"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              autoFocus
            />
            <button className="ml-2 text-gray-500 text-base font-medium hover:underline" onClick={() => setSearchOpen(false)}>Cancel</button>
          </div>
        )}
        {/* Flag dropdown */}
        <div className="relative">
          <button
            className="flex items-center gap-1 p-2 rounded hover:bg-gray-100"
            onClick={() => setDropdownOpen((v) => !v)}
          >
            <Image src={selectedFlag.topIcon} alt={selectedFlag.name} width={24} height={24} />
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-20">
              {flags.map(flag => (
                <button
                  key={flag.name}
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-gray-100"
                  onClick={() => handleFlagSelect(flag)}
                >
                  <div className="flex items-center gap-2">
                    <Image src={flag.src} alt={flag.name} width={20} height={20} />
                    <span>{flag.name}</span>
                  </div>
                  {selectedFlag.name === flag.name && (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="green" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
      {/* Hamburger Menu Overlay */}
      {menuOpen && (
        <div ref={menuRef} className="fixed left-0 right-0 top-[64px] w-full bg-white shadow-2xl z-50 rounded-b-xl animate-slide-down">
          <div className="flex flex-col gap-6 px-10 py-4 text-gray-800 text-base font-medium">
            <Link href="/briefly" className="hover:underline">Blog</Link>
            <Link href="/calculator" className="hover:underline">Calculator</Link>
            <Link href="/about" className="hover:underline">About Us</Link>
            <Link href="/contact" className="hover:underline">Contact Us</Link>
          </div>
        </div>
      )}
      {/* Search Suggestion Panel + Results */}
      {searchOpen && (
        <div 
          className="fixed top-0 left-0 w-full bg-white z-50 px-0 sm:px-0 pt-8 pb-12 animate-slide-down overflow-y-auto max-h-screen"
          onClick={(e) => {
            // Prevent clicks on the overlay from interfering with card clicks
            if (e.target === e.currentTarget) {
              setSearchOpen(false);
            }
          }}
        >
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex items-center gap-4 mb-6">
              <Image src="/assets/logo.png" alt="Booldo Logo" width={100} height={40} className="hidden sm:block" />
              <div className="flex-1 flex items-center bg-[#f6f7f9] border border-gray-200 rounded-lg px-3 py-2">
                <svg className="text-gray-400 mr-2" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="search"
                  className="bg-transparent outline-none text-gray-700 w-full placeholder-gray-400"
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  autoFocus
                />
              </div>
              <button className="ml-4 text-gray-500 text-base font-medium hover:underline" onClick={() => setSearchOpen(false)}>Cancel</button>
            </div>
            {/* Search Results */}
            <div>
              {searchLoading && <div className="text-center text-gray-400">Searching...</div>}
              {searchError && <div className="text-center text-red-500">{searchError}</div>}
              {!searchLoading && !searchError && searchResults.length === 0 && searchValue && (
                <div className="text-center text-gray-400">No results found.</div>
              )}
              {!searchLoading && !searchError && searchResults.length > 0 && (
                <div className="flex flex-col gap-4 mb-6">
                  {searchResults.map((item) => {
                    // Handle different content types
                    const getItemTitle = () => {
                      switch (item._type) {
                        case 'offers':
                          const bonusTypeName = item.bonusType?.name || 'Bonus';
                          const bookmakerName = item.bookmaker?.name || 'Bookmaker';
                          console.log('Offer item data:', { 
                            bonusType: item.bonusType, 
                            bookmaker: item.bookmaker,
                            bonusTypeName,
                            bookmakerName 
                          }); // Debug log
                          // If we have both names, show them, otherwise show what we have
                          if (bonusTypeName && bookmakerName && bonusTypeName !== 'Bonus' && bookmakerName !== 'Bookmaker') {
                            return `${bonusTypeName} - ${bookmakerName}`;
                          } else if (bonusTypeName && bonusTypeName !== 'Bonus') {
                            return `${bonusTypeName} Offer`;
                          } else if (bookmakerName && bookmakerName !== 'Bookmaker') {
                            return `${bookmakerName} Offer`;
                          } else {
                            return 'Offer';
                          }
                        case 'article':
                          return item.title || 'Article';
                        case 'bookmaker':
                          return item.name || 'Bookmaker';
                        case 'bonusType':
                          return item.name || 'Bonus Type';
                        case 'banner':
                          return item.title || 'Banner';
                        case 'comparison':
                          return item.title || 'Comparison';
                        case 'faq':
                          return item.question || 'FAQ';
                        default:
                          return 'Unknown';
                      }
                    };

                    const getItemDescription = () => {
                      switch (item._type) {
                        case 'offers':
                          // Handle PortableText or string
                          if (typeof item.description === 'string') {
                            return item.description;
                          } else if (item.description && Array.isArray(item.description)) {
                            // Extract text from PortableText blocks
                            return item.description
                              .map(block => {
                                if (block.children) {
                                  return block.children.map(child => child.text).join('');
                                }
                                return '';
                              })
                              .join(' ')
                              .substring(0, 150) + (item.description.length > 150 ? '...' : '');
                          }
                          return '';
                        case 'article':
                          return item.excerpt || '';
                        case 'bookmaker':
                          return item.description || '';
                        case 'bonusType':
                          return item.description || '';
                        case 'banner':
                          return item.imageAlt || '';
                        case 'comparison':
                          // Handle PortableText or string
                          if (typeof item.content === 'string') {
                            return item.content.substring(0, 150) + (item.content.length > 150 ? '...' : '');
                          } else if (item.content && Array.isArray(item.content)) {
                            return item.content
                              .map(block => {
                                if (block.children) {
                                  return block.children.map(child => child.text).join('');
                                }
                                return '';
                              })
                              .join(' ')
                              .substring(0, 150) + (item.content.length > 150 ? '...' : '');
                          }
                          return '';
                        case 'faq':
                          return item.answer || '';
                        default:
                          return '';
                      }
                    };

                    const getItemImage = () => {
                      switch (item._type) {
                        case 'offers':
                          return item.bookmaker?.logo;
                        case 'bookmaker':
                          return item.logo;
                        case 'banner':
                          return item.image;
                        default:
                          return null;
                      }
                    };

                    const getItemDate = () => {
                      switch (item._type) {
                        case 'offers':
                          return item.published;
                        case 'article':
                          return item.publishedAt;
                        default:
                          return '';
                      }
                    };

                    const getItemUrl = () => {
                      switch (item._type) {
                        case 'offers':
                          if (item.slug?.current) {
                            return `/${country === "Nigeria" ? "ng" : "gh"}/offers/${item.slug.current}`;
                          }
                          return `/${country === "Nigeria" ? "ng" : "gh"}/offers`;
                        case 'article':
                          if (item.slug?.current) {
                            return `/briefly/${item.slug.current}`;
                          }
                          return '/briefly';
                        case 'bookmaker':
                          // Use the bookmaker name to create a filter URL like the filter system
                          if (item.name) {
                            const bookmakerSlug = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                            return `/${country === "Nigeria" ? "ng" : "gh"}/${bookmakerSlug}`;
                          }
                          return `/${country === "Nigeria" ? "ng" : "gh"}/offers`;
                        case 'bonusType':
                          if (item.slug?.current) {
                            return `/${item.slug.current}`;
                          }
                          return '/';
                        case 'banner':
                          return `/${country === "Nigeria" ? "ng" : "gh"}`;
                        case 'comparison':
                          return `/${country === "Nigeria" ? "ng" : "gh"}`;
                        case 'faq':
                          return '/faq';
                        default:
                          return '/';
                      }
                    };

                    const getItemIcon = () => {
                      switch (item._type) {
                        case 'offers':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                          );
                        case 'article':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14,2 14,8 20,8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                              <polyline points="10,9 9,9 8,9"/>
                            </svg>
                          );
                        case 'bookmaker':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            </svg>
                          );
                        case 'bonusType':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                          );
                        case 'banner':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21,15 16,10 5,21"/>
                            </svg>
                          );
                        case 'comparison':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M9 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z"/>
                              <path d="M21 11h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2z"/>
                              <path d="M15 3h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
                            </svg>
                          );
                        case 'faq':
                          return (
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          );
                        default:
                          return null;
                      }
                    };

                    return (
                      <div
                        key={item._id}
                                              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-gray-200 cursor-pointer group"
                                              onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const url = getItemUrl();
                          if (url && url !== '#') {
                            // Close search first, then navigate
                        setSearchOpen(false);
                            // Small delay to ensure search closes before navigation
                            setTimeout(() => {
                              router.replace(url);
                            }, 100);
                          }
                      }}
                    >
                      <div className="flex items-center gap-4">
                          {getItemImage() ? (
                            <Image src={urlFor(getItemImage()).width(48).height(48).url()} alt={getItemTitle()} width={48} height={48} className="rounded-md" />
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center">
                              {getItemIcon()}
                            </div>
                        )}
                        <div>
                            <div className="font-semibold text-gray-900 text-base group-hover:text-green-600 transition-colors">{getItemTitle()}</div>
                            <div className="text-sm text-gray-500 mt-1">{getItemDescription()}</div>
                            {item._type === 'offers' && item.expires && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                                <span className="inline-flex items-center gap-1">
                                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                  </svg>
                                  Expires: {item.expires}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end mt-4 sm:mt-0">
                          <span className="text-xs text-gray-400 mb-2">
                            {getItemDate() && `Published: ${getItemDate()}`}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">{item._type}</span>
                      </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Popular Searches */}
              {!searchLoading && !searchError && !searchValue && (
                <div className="mb-6">
                  <div className="text-gray-500 text-sm mb-2 font-medium">Popular Searches</div>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((term, idx) => (
                      <button
                        key={term + idx}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-4 py-2 text-sm font-medium transition"
                        onClick={() => {
                          setSearchValue(term);
                        }}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="mt-6">
                      <div className="text-gray-500 text-sm mb-2 font-medium">Recent Searches</div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term, idx) => (
                          <button
                            key={term + idx}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-4 py-2 text-sm font-medium transition"
                            onClick={() => setSearchValue(term)}
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 