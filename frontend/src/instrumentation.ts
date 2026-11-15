/**
 * Runs once per server start, before the first request. On AWS Lambda the signing secret of the API proxy is read
 * from SSM Parameter Store here, so it never sits in Terraform state or in the function's plain environment.
 * Other hosts (Vercel, docker, dev) set `PROXY_HMAC_SECRET` directly and leave `SSM_PATH_PREFIX` unset.
 * A missing or unreadable secret throws: the function then fails its init instead of serving unsigned requests
 * that the API would reject anyway.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const prefix = process.env.SSM_PATH_PREFIX;
  if (!prefix || process.env.PROXY_HMAC_SECRET) return;
  const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
  const result = await new SSMClient({}).send(
    new GetParameterCommand({ Name: `${prefix}proxy_hmac_secret`, WithDecryption: true }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${prefix}proxy_hmac_secret is empty`);
  process.env.PROXY_HMAC_SECRET = value;
}
