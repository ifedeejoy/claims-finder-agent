import { GoogleGenerativeAI } from '@google/generative-ai'
import { ExtractedCaseSchema, type ExtractedCase, type EligibilityQuestion } from '@/types'
import { AIExtractionError } from '@/types'

let genAI: GoogleGenerativeAI | null = null
let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

function initializeGemini() {
  if (!genAI || !model) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    genAI = new GoogleGenerativeAI(apiKey)
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8000,
      }
    })
  }

  if (!genAI || !model) {
    throw new Error('Failed to initialize Gemini AI')
  }

  return { genAI, model }
}

export class GeminiService {
  /**
   * Extract comprehensive legal case information from raw text content
   */
  async extractCaseDetails(rawText: string, sourceUrl?: string): Promise<ExtractedCase & { questions?: EligibilityQuestion[] }> {
    try {
      const { model: geminiModel } = initializeGemini()
      const prompt = this.buildEnhancedExtractionPrompt(rawText, sourceUrl)

      const result = await geminiModel.generateContent(prompt)
      const responseText = result.response.text()

      // Parse JSON from the response
      let extractedData
      try {
        // Extract JSON from response (it might be wrapped in code blocks)
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*}/)
        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText
        extractedData = JSON.parse(jsonString)
      } catch {
        throw new AIExtractionError('Failed to parse JSON from AI response', rawText)
      }

      // Validate the extracted data against our schema
      const validated = ExtractedCaseSchema.parse(extractedData)

      // Generate eligibility questions if we have criteria
      let questions: EligibilityQuestion[] = []
      if (validated.eligibilityFull?.required || validated.eligibilityPreview) {
        questions = this.generateEligibilityQuestions(validated)
      }

      return { ...validated, questions }

    } catch (error) {
      if (error instanceof AIExtractionError) {
        throw error
      }
      throw new AIExtractionError(
        `Gemini extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawText
      )
    }
  }

  /**
   * Generate eligibility questions based on extracted case data
   */
  private generateEligibilityQuestions(caseData: ExtractedCase): EligibilityQuestion[] {
    const questions: EligibilityQuestion[] = []
    let order = 1

    // Determine case type and add appropriate questions
    const category = caseData.category?.toLowerCase() || ''

    // Basic qualifying question
    if (category.includes('data breach') || category.includes('privacy')) {
      questions.push({
        questionOrder: order++,
        questionText: 'Were you affected by the data breach or privacy incident?',
        questionType: 'boolean',
        required: true,
        disqualifyingAnswers: [false]
      })
    } else if (category.includes('product') || category.includes('defect')) {
      questions.push({
        questionOrder: order++,
        questionText: 'Did you purchase or use the affected product?',
        questionType: 'boolean',
        required: true,
        disqualifyingAnswers: [false]
      })
    } else {
      // Generic question
      questions.push({
        questionOrder: order++,
        questionText: 'Were you affected by the issue described in this case?',
        questionType: 'boolean',
        required: true,
        disqualifyingAnswers: [false]
      })
    }

    // Add date range question if applicable
    if (caseData.importantDates?.classStart || caseData.importantDates?.classEnd) {
      questions.push({
        questionOrder: order++,
        questionText: 'When were you affected?',
        questionType: 'date',
        required: true
      })
    }

    // Add documentation question if proof required
    if (caseData.proofRequired || caseData.documentationRequired?.length) {
      questions.push({
        questionOrder: order++,
        questionText: 'Do you have documentation to support your claim?',
        questionType: 'boolean',
        required: false
      })
    }

    // Add specific questions based on eligibility criteria
    if (caseData.eligibilityFull?.required) {
      caseData.eligibilityFull.required.forEach(criteria => {
        if (criteria.toLowerCase().includes('state') || criteria.toLowerCase().includes('resident')) {
          questions.push({
            questionOrder: order++,
            questionText: 'In which state do you reside?',
            questionType: 'text',
            required: true
          })
        }
      })
    }

    return questions
  }

  /**
   * Build an enhanced extraction prompt for comprehensive case details
   */
  private buildEnhancedExtractionPrompt(rawText: string, sourceUrl?: string): string {
    return `You are a legal claim extraction expert. Extract comprehensive information about legal settlements, class actions, or consumer claims from the following text.

${sourceUrl ? `Source URL: ${sourceUrl}` : ''}

TEXT TO ANALYZE:
${rawText.substring(0, 15000)} // Increased limit for more context

Extract and return a detailed JSON object with ALL available information:

{
  "title": "Clear, descriptive title of the legal case",
  "description": "Brief 2-3 sentence summary",
  "fullDescription": "Complete detailed description including background, what happened, who is affected, and why this settlement exists",
  
  "eligibilityPreview": ["List of main eligibility points for quick display"],
  "eligibilityFull": {
    "required": ["All mandatory eligibility requirements"],
    "optional": ["Optional criteria that might increase payout"],
    "restrictions": ["Any disqualifying factors"]
  },
  
  "deadlineDate": "YYYY-MM-DD format deadline to file claim",
  "claimUrl": "URL where users can file their claim",
  "claimFormUrl": "Direct URL to the claim form if different from claimUrl",
  "proofRequired": true/false,
  "estimatedPayout": "Payout amount or range",
  "category": "Type of case (data breach, product defect, financial services, etc)",
  
  "howToClaim": "Step-by-step instructions on how to file a claim",
  
  "importantDates": {
    "classStart": "Start date of class period",
    "classEnd": "End date of class period", 
    "filingDeadline": "Deadline to file claim",
    "exclusionDeadline": "Deadline to exclude yourself",
    "finalApprovalHearing": "Date of final approval hearing",
    "paymentDate": "Estimated payment date"
  },
  
  "contactInfo": {
    "phone": "Contact phone number",
    "email": "Contact email",
    "mailingAddress": "Mailing address for paper claims",
    "website": "Official settlement website",
    "lawFirm": "Name of law firm handling the case"
  },
  
  "documentationRequired": ["List of documents needed to file claim"],
  
  "faqs": [
    {
      "question": "Common question",
      "answer": "Answer to the question"
    }
  ],
  
  "externalRedirect": false // Set to false since we want to display details in our app
}

IMPORTANT RULES:
- Extract AS MUCH detail as possible from the text
- For dates, use YYYY-MM-DD format or null if not found
- For URLs, ensure they are complete and valid
- Set externalRedirect to false so claims are displayed in our app
- If information is not found, use null (not empty string)
- Be very thorough in extracting eligibility criteria
- Include all contact methods found
- Extract any FAQs or Q&A sections

Return ONLY the JSON object, no other text.`
  }

  /**
   * Process a simple eligibility check
   */
  async checkEligibility(
    caseData: ExtractedCase,
    userResponses: Record<string, string | number | boolean | string[]>
  ): Promise<{ isEligible: boolean; score: number; reasons: string[] }> {
    try {
      const { model: geminiModel } = initializeGemini()

      const prompt = `Based on the following case eligibility criteria and user responses, determine if the user is eligible:

CASE: ${caseData.title}

ELIGIBILITY CRITERIA:
${JSON.stringify(caseData.eligibilityFull || caseData.eligibilityPreview, null, 2)}

USER RESPONSES:
${JSON.stringify(userResponses, null, 2)}

Return a JSON object:
{
  "isEligible": true/false,
  "score": 0-100 (eligibility confidence score),
  "reasons": ["List of reasons for the decision"]
}`

      const result = await geminiModel.generateContent(prompt)
      const responseText = result.response.text()

      const jsonMatch = responseText.match(/{[\s\S]*}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      return {
        isEligible: false,
        score: 0,
        reasons: ['Unable to determine eligibility']
      }
    } catch (error) {
      console.error('Eligibility check failed:', error)
      return {
        isEligible: false,
        score: 0,
        reasons: ['Error checking eligibility']
      }
    }
  }

  /**
   * Helper method to extract JSON from AI responses that might be wrapped in markdown
   */
  private extractJSON(responseText: string): any {
    try {
      // First try to extract from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // Then try to find a JSON object
      const objectMatch = responseText.match(/{[\s\S]*}/)
      if (objectMatch) {
        return JSON.parse(objectMatch[0])
      }

      // Finally try parsing the whole response
      return JSON.parse(responseText)
    } catch (error) {
      throw new Error(`Failed to extract JSON from response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generic content generation for flexible AI tasks
   */
  async generateContent(prompt: string): Promise<{ response: { text: () => string } }> {
    try {
      const { model: geminiModel } = initializeGemini()
      const result = await geminiModel.generateContent(prompt)
      return {
        response: {
          text: () => result.response.text()
        }
      }
    } catch (error) {
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate JSON content from a prompt
   */
  async generateJSON(prompt: string): Promise<any> {
    try {
      const { model: geminiModel } = initializeGemini()
      const result = await geminiModel.generateContent(prompt)
      const responseText = result.response.text()
      return this.extractJSON(responseText)
    } catch (error) {
      throw new Error(`JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract structured data from an image using Gemini Vision
   */
  async extractWithImage(prompt: string, imageBase64: string): Promise<unknown> {
    try {
      // Initialize Gemini if not already initialized
      const { genAI: aiInstance } = initializeGemini()

      if (!aiInstance) {
        throw new Error('Gemini AI not initialized. Check GEMINI_API_KEY environment variable.')
      }

      const visionModel = aiInstance.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        }
      })

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png"
        }
      }

      const result = await visionModel.generateContent([prompt, imagePart])
      const response = await result.response
      const text = response.text()

      // Try to parse JSON if present
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch {
          // If JSON parsing fails, return raw text
          return text
        }
      }

      return text
    } catch (error) {
      console.error('Gemini image analysis failed:', error)
      throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export const geminiService = new GeminiService()
