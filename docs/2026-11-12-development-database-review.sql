-- Read-only inventory for the Neon development branch. This returns table and
-- column names only; it does not return news articles, user records or secrets.
-- Select the development branch in the Neon SQL Editor before running it.
WITH expected(table_name) AS (
  VALUES ('FactCheckUser'), ('FactCheckArticle'), ('FactCheckReport'),
         ('FactCheckClaim'), ('FactCheckEvidence'), ('FactCheckJob'),
         ('FactCheckClaimCheckpoint'), ('FactCheckIdentificationCheckpoint'),
         ('FactCheckEvaluationCheckpoint'), ('_prisma_migrations')
)
SELECT e.table_name,
       CASE WHEN t.table_name IS NULL THEN 'missing' ELSE 'present' END AS status,
       COALESCE(string_agg(c.column_name, ', ' ORDER BY c.ordinal_position), '') AS columns
FROM expected e
LEFT JOIN information_schema.tables t ON t.table_schema = 'public' AND t.table_name = e.table_name
LEFT JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = e.table_name
GROUP BY e.table_name, t.table_name
ORDER BY e.table_name;
