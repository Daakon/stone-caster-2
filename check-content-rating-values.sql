-- Check existing content_rating values in entry_points
SELECT DISTINCT content_rating, COUNT(*) as count
FROM public.entry_points 
GROUP BY content_rating
ORDER BY content_rating;

